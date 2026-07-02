/**
 * Telegram Webhook Receiver
 *
 * Telegram POSTs every update for @botpatapimbot here. We resolve each chat to
 * a route — either the v2 per-account DO (TelegramAccount, keyed by email) or
 * the legacy per-install DO (TelegramInstance, keyed by instance_id) — and
 * forward the update there.
 *
 * Handshake: /start <pairing_code> is the only message we handle from a
 * not-yet-paired chat. A v2 code (tg:pair-v2:*) binds chat_id → email; a legacy
 * code (tg:pair:*) binds chat_id → instance_id. Bindings persist until /unlink.
 *
 * NOTE: the v2 (account) routing in this file was recovered from the deployed
 * Cloudflare Worker bundle — the original source was lost from version control.
 * It is a faithful transcription of the live production handler.
 */

import type { APIRoute } from 'astro';
import { sendMessage, answerCallbackQuery } from '../../../lib/telegram/bot-api';
import type { TelegramUpdate } from '../../../lib/telegram/bot-api';

export const prerender = false;

type Route =
  | { kind: 'v2'; email: string }
  | { kind: 'legacy'; instance_id: string };

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const request = context.request;

  // Verify secret header so random callers can't inject updates.
  const expected = env.TELEGRAM_WEBHOOK_SECRET;
  const got = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (!expected || got !== expected) {
    return new Response('unauthorized', { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json() as TelegramUpdate;
  } catch {
    return new Response('bad json', { status: 400 });
  }

  try {
    await routeUpdate(update, env);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[telegram/webhook] routeUpdate failed:', msg);
  }

  // Telegram retries on non-2xx. Always 200 unless the payload is malformed.
  return new Response('ok');
};

async function routeUpdate(update: TelegramUpdate, env: any) {
  // Inline-button taps: PATAPIM uses callback_data on planReady prompts so a
  // tap doesn't open a browser. Resolve the chat's route, attach the tracked
  // terminal_id, and forward to the DO as a `callback_query` frame.
  if (update.callback_query) {
    await routeCallbackQuery(update.callback_query, env);
    return;
  }
  const msg = update.message;
  if (!msg) return;
  const chatId = msg.chat?.id;
  if (!chatId) return;

  // /start <code> handshake — unauthenticated path. v2 codes take precedence.
  if (msg.text && msg.text.startsWith('/start')) {
    const parts = msg.text.split(/\s+/);
    const code = (parts[1] || '').toUpperCase();
    if (!code) {
      await sendMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: chatId,
        text: 'Hi! To pair this chat with your PATAPIM install, open Preferences → Notifications → Telegram in PATAPIM and click "Connect to Telegram".',
      });
      return;
    }
    const v2Email = await env.SESSIONS.get(`tg:pair-v2:${code}`);
    if (v2Email) {
      await env.SESSIONS.delete(`tg:pair-v2:${code}`);
      await completeV2Pair(env, chatId, msg.chat, v2Email);
      return;
    }
    const instanceId = await env.SESSIONS.get(`tg:pair:${code}`);
    if (instanceId) {
      await env.SESSIONS.delete(`tg:pair:${code}`);
      await completeLegacyPair(env, chatId, msg.chat, instanceId);
      return;
    }
    await sendMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: chatId,
      text: '❌ Pairing code invalid or expired. Open PATAPIM and request a new one.',
    });
    return;
  }

  // Reply-to-bot-message: route to the originating account/instance + terminal
  // even if it's not the current chat-active receiver. The DO that sent the
  // original message wrote tg:msg-v2:<chat>:<msg_id> (or legacy tg:msg:*) with
  // the route + terminal_id. When found, we override routing.
  let route: Route | null = null;
  let originTerminalId = '';
  let originInstanceId = '';
  let originBootId = '';
  const repliedTo = msg.reply_to_message;
  if (repliedTo && repliedTo.message_id) {
    const overlay = await lookupMsgRoute(env, chatId, repliedTo.message_id);
    if (overlay) {
      route = overlay.route;
      originTerminalId = overlay.terminal_id || '';
      originInstanceId = overlay.instance_id || '';
      originBootId = overlay.boot_id || '';
    }
  }

  // Fallback: standard chat → bound route.
  if (!route) {
    route = await resolveChatRoute(env, chatId);
  }
  if (!route) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: chatId,
      text: 'This chat is not linked. In PATAPIM go to Preferences → Notifications → Telegram and click "Connect to Telegram".',
    });
    return;
  }
  if (originTerminalId) {
    (msg as any)._patapim_terminal_id = originTerminalId;
    if (originInstanceId) (msg as any)._patapim_origin_instance = originInstanceId;
    if (originBootId) (msg as any)._patapim_boot_id = originBootId;
  }

  // Voice/audio: two paths depending on duration.
  //   - dur <= INLINE: download bytes, ship inline as base64. PATAPIM transcribes
  //     locally with Parakeet, falls back to Workers AI Whisper via the
  //     `transcribe_voice` WS handler if Parakeet fails.
  //   - INLINE < dur <= HARD: too big to ship inline reliably, so we transcribe
  //     here with Workers AI Whisper-large-v3-turbo and forward the transcript
  //     as msg.text (with a flag the listener picks up to mirror the voice echo).
  //   - dur > HARD: reject.
  const VOICE_INLINE_MAX_SEC = 120;
  const VOICE_HARD_MAX_SEC = 600; // 10 min — Workers AI input cap is 4 MiB,
                                  // typical Telegram OGG/Opus is ~5 KB/sec so
                                  // 10 min ≈ 3 MB, comfortably under the cap.
  if (msg.voice || msg.audio) {
    const file = msg.voice || msg.audio;
    const dur = file?.duration || 0;
    if (file && file.file_id && dur <= VOICE_INLINE_MAX_SEC) {
      try {
        const audioBuf = await downloadTelegramFile(env, file.file_id);
        (msg as any).audio_b64 = arrayBufferToBase64(audioBuf);
        (msg as any).audio_mime = msg.voice ? 'audio/ogg' : (msg.audio?.mime_type || 'audio/ogg');
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn('[telegram/webhook] voice download failed:', errMsg);
        await sendMessage(env.TELEGRAM_BOT_TOKEN, {
          chat_id: chatId,
          reply_to_message_id: msg.message_id,
          text: `🎤 Couldn't fetch audio: ${errMsg.slice(0, 160)}`,
        });
        return;
      }
    } else if (file && file.file_id && dur <= VOICE_HARD_MAX_SEC) {
      try {
        const audioBuf = await downloadTelegramFile(env, file.file_id);
        const aiResult = await env.AI.run(
          '@cf/openai/whisper-large-v3-turbo',
          { audio: [...new Uint8Array(audioBuf)] },
        ) as { text?: string };
        const transcript = (aiResult?.text || '').trim();
        if (!transcript) {
          await sendMessage(env.TELEGRAM_BOT_TOKEN, {
            chat_id: chatId,
            reply_to_message_id: msg.message_id,
            text: '🎤 Could not transcribe — Whisper returned empty.',
          });
          return;
        }
        (msg as any).text = transcript;
        (msg as any)._patapim_voice_pretranscribed = true;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn('[telegram/webhook] long-voice transcribe failed:', errMsg);
        await sendMessage(env.TELEGRAM_BOT_TOKEN, {
          chat_id: chatId,
          reply_to_message_id: msg.message_id,
          text: `🎤 Transcription failed: ${errMsg.slice(0, 200)}`,
        });
        return;
      }
    } else if (file && dur > VOICE_HARD_MAX_SEC) {
      const minutes = Math.floor(VOICE_HARD_MAX_SEC / 60);
      await sendMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: chatId,
        reply_to_message_id: msg.message_id,
        text: `🎤 Voice messages over ${minutes} min are not supported. Trim it down.`,
      });
      return;
    }
  }

  const doStub = getRouteStub(env, route);
  await doStub.fetch('https://do/__internal/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      update,
      // Replies bound to a specific install must never land on another one:
      // the account DO delivers only to this instance's sockets and queues
      // for it when offline.
      target_instance_id: route.kind === 'v2' ? originInstanceId : '',
    }),
  });
}

async function routeCallbackQuery(cq: NonNullable<TelegramUpdate['callback_query']>, env: any) {
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  if (!chatId) return;

  // No binding for this chat → nothing to forward to. Ack so the spinner
  // clears, but don't expose any UX detail.
  const route = await resolveChatRoute(env, chatId);
  if (!route) {
    await answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, cq.id, 'This chat is not linked.', true).catch(() => {});
    return;
  }

  // Look up the per-message binding so the DO can attach _patapim_terminal_id
  // and target the owning install before forwarding. Only honor it if it
  // routes to the same account/install as the chat (no cross-account leaks).
  let terminalId = '';
  let targetInstanceId = '';
  let bootId = '';
  if (messageId) {
    const overlay = await lookupMsgRoute(env, chatId, messageId);
    if (overlay && sameRoute(overlay.route, route)) {
      terminalId = overlay.terminal_id || '';
      targetInstanceId = overlay.instance_id || '';
      bootId = overlay.boot_id || '';
    }
  }

  // Mutate a shallow copy of the update so the DO/client receive the binding.
  const cqOut = terminalId && cq.message
    ? {
        ...cq,
        message: {
          ...cq.message,
          _patapim_terminal_id: terminalId,
          ...(bootId ? { _patapim_boot_id: bootId } : {}),
        },
      }
    : cq;

  const doStub = getRouteStub(env, route);
  await doStub.fetch('https://do/__internal/callback_query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query: cqOut,
      target_instance_id: route.kind === 'v2' ? targetInstanceId : '',
    }),
  });
}

/** Resolve a chat's bound route, preferring the v2 (account) binding. */
async function resolveChatRoute(env: any, chatId: number): Promise<Route | null> {
  const v2 = await env.SESSIONS.get(`tg:chat-v2:${chatId}`);
  if (v2) return { kind: 'v2', email: v2 };
  const legacy = await env.SESSIONS.get(`tg:chat:${chatId}`);
  if (legacy) return { kind: 'legacy', instance_id: legacy };
  return null;
}

/** Get the DO stub for a route (account DO for v2, instance DO for legacy). */
function getRouteStub(env: any, route: Route) {
  if (route.kind === 'v2') {
    return env.TELEGRAM_ACCOUNT.get(env.TELEGRAM_ACCOUNT.idFromName(route.email));
  }
  return env.TELEGRAM_INSTANCE.get(env.TELEGRAM_INSTANCE.idFromName(route.instance_id));
}

function sameRoute(a: Route, b: Route): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'v2' && b.kind === 'v2') return a.email === b.email;
  if (a.kind === 'legacy' && b.kind === 'legacy') return a.instance_id === b.instance_id;
  return false;
}

/** Look up the per-message routing overlay (tg:msg-v2:* then legacy tg:msg:*). */
async function lookupMsgRoute(
  env: any,
  chatId: number,
  messageId: number,
): Promise<{ route: Route; terminal_id: string; instance_id: string; boot_id: string } | null> {
  try {
    const raw = await env.SESSIONS.get(`tg:msg-v2:${chatId}:${messageId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        email?: string;
        terminal_id?: string;
        instance_id?: string;
        boot_id?: string;
      };
      if (parsed.email) {
        return {
          route: { kind: 'v2', email: parsed.email },
          terminal_id: parsed.terminal_id || '',
          instance_id: parsed.instance_id || '',
          boot_id: parsed.boot_id || '',
        };
      }
    }
  } catch (err) {
    console.warn('[telegram/webhook] msg-v2 KV lookup failed:', err);
  }
  try {
    const raw = await env.SESSIONS.get(`tg:msg:${chatId}:${messageId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as { instance_id?: string; terminal_id?: string; boot_id?: string };
      if (parsed.instance_id) {
        return {
          route: { kind: 'legacy', instance_id: parsed.instance_id },
          terminal_id: parsed.terminal_id || '',
          // The legacy route already addresses the owning install's own DO;
          // no account-level instance targeting applies.
          instance_id: '',
          boot_id: parsed.boot_id || '',
        };
      }
    }
  } catch (err) {
    console.warn('[telegram/webhook] msg KV lookup failed:', err);
  }
  return null;
}

async function completeV2Pair(env: any, chatId: number, chat: any, email: string) {
  // If this chat was already linked, notify the previous owner so its toggles
  // drop, then overwrite the binding.
  const previous = await resolveChatRoute(env, chatId);
  if (previous) {
    if (previous.kind === 'v2' && previous.email !== email) {
      try {
        const oldStub = getRouteStub(env, previous);
        await oldStub.fetch('https://do/__internal/active-lost', { method: 'POST' }).catch(() => {});
      } catch (err) {
        console.warn('[telegram/webhook] v2-handoff cross-DO failed:', err);
      }
    } else if (previous.kind === 'legacy') {
      try {
        const oldStub = getRouteStub(env, previous);
        await oldStub.fetch('https://do/__internal/active-lost', { method: 'POST' }).catch(() => {});
      } catch (err) {
        console.warn('[telegram/webhook] legacy-handoff cross-DO failed:', err);
      }
      await env.SESSIONS.delete(`tg:chat:${chatId}`).catch(() => {});
    }
  }
  await env.SESSIONS.put(`tg:chat-v2:${chatId}`, email);
  const hint = chat.username ? `@${chat.username}` : (chat.first_name || String(chatId));
  const stub = env.TELEGRAM_ACCOUNT.get(env.TELEGRAM_ACCOUNT.idFromName(email));
  await stub.fetch('https://do/__internal/pair-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, chat_id_hint: hint }),
  });
  await sendMessage(env.TELEGRAM_BOT_TOKEN, {
    chat_id: chatId,
    text: `✅ Linked to PATAPIM.\n\nThis chat is now connected. Anything you send here will go to your active terminal; I'll reply with the output.`,
  });
}

async function completeLegacyPair(env: any, chatId: number, chat: any, instanceId: string) {
  const previousInstanceId = await env.SESSIONS.get(`tg:chat:${chatId}`);
  if (previousInstanceId && previousInstanceId !== instanceId) {
    try {
      const oldStub = env.TELEGRAM_INSTANCE.get(env.TELEGRAM_INSTANCE.idFromName(previousInstanceId));
      await oldStub.fetch('https://do/__internal/active-lost', { method: 'POST' });
    } catch (err) {
      console.warn('[telegram/webhook] active-lost cross-DO failed:', err);
    }
  }
  await env.SESSIONS.put(`tg:chat:${chatId}`, instanceId);
  const hint = chat.username ? `@${chat.username}` : (chat.first_name || String(chatId));
  const stub = env.TELEGRAM_INSTANCE.get(env.TELEGRAM_INSTANCE.idFromName(instanceId));
  await stub.fetch('https://do/__internal/pair-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, chat_id_hint: hint }),
  });
  await sendMessage(env.TELEGRAM_BOT_TOKEN, {
    chat_id: chatId,
    text: `✅ Linked to PATAPIM.\n\nThis chat is now connected. Anything you send here will go to your active terminal; I'll reply with the output.`,
  });
}

async function downloadTelegramFile(env: any, file_id: string): Promise<ArrayBuffer> {
  const fileRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(file_id)}`);
  const fileJson = await fileRes.json() as { ok: boolean; result?: { file_path: string }; description?: string };
  if (!fileJson.ok || !fileJson.result?.file_path) {
    throw new Error(`getFile failed: ${fileJson.description || 'unknown'}`);
  }
  const audioRes = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileJson.result.file_path}`);
  if (!audioRes.ok) {
    throw new Error(`audio download failed: HTTP ${audioRes.status}`);
  }
  return audioRes.arrayBuffer();
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
