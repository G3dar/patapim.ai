/**
 * Telegram Webhook Receiver
 *
 * Telegram POSTs every update for @iampatapimbot here. We route by chat_id
 * to the right TelegramInstance Durable Object via a KV lookup maintained
 * on /start and /unlink.
 *
 * Handshake: /start <pairing_code> is the only message we handle from a
 * not-yet-paired chat — it consumes the pairing code and binds
 * chat_id → instance_id permanently (until /unlink).
 */

import type { APIRoute } from 'astro';
import { sendMessage, answerCallbackQuery as tgAnswerCallback } from '../../../lib/telegram/bot-api';
import type { TelegramUpdate } from '../../../lib/telegram/bot-api';

export const prerender = false;

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
  // tap doesn't open a browser. We resolve the bound instance from chat_id,
  // attach the tracked terminal_id (same `tg:msg:*` KV that handles message
  // replies), and forward to the DO as a `callback_query` frame.
  if (update.callback_query) {
    await routeCallbackQuery(update.callback_query, env);
    return;
  }
  const msg = update.message;
  if (!msg) return;
  const chatId = msg.chat?.id;
  if (!chatId) return;

  // /start <code> handshake — unauthenticated path.
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
    const instanceId = await env.SESSIONS.get(`tg:pair:${code}`);
    if (!instanceId) {
      await sendMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: chatId,
        text: '❌ Pairing code invalid or expired. Open PATAPIM and request a new one.',
      });
      return;
    }
    await env.SESSIONS.delete(`tg:pair:${code}`);
    // If this chat was already linked to a different instance, notify it
    // first so it can drop its airplane toggles before we overwrite the KV.
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
    const hint = msg.chat.username ? `@${msg.chat.username}` : (msg.chat.first_name || String(chatId));
    const doStub = env.TELEGRAM_INSTANCE.get(env.TELEGRAM_INSTANCE.idFromName(instanceId));
    await doStub.fetch('https://do/__internal/pair-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, chat_id_hint: hint }),
    });
    await sendMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: chatId,
      text: `✅ Linked to PATAPIM.\n\nThis chat is now connected. Anything you send here will go to your active terminal; I'll reply with the output.`,
    });
    return;
  }

  // Reply-to-bot-message: route to the originating instance/terminal even
  // if it's not the current chat-active receiver. The DO that sent the
  // original message wrote tg:msg:<chat>:<msg_id> → { instance_id, terminal_id }
  // (30d TTL). When found, we override routing and inject the terminal hint.
  let instanceId: string | null = null;
  let originTerminalId = '';
  const repliedTo = msg.reply_to_message;
  if (repliedTo && repliedTo.message_id) {
    try {
      const raw = await env.SESSIONS.get(`tg:msg:${chatId}:${repliedTo.message_id}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { instance_id?: string; terminal_id?: string };
        if (parsed.instance_id) {
          instanceId = parsed.instance_id;
          originTerminalId = parsed.terminal_id || '';
        }
      }
    } catch (err) {
      console.warn('[telegram/webhook] msg-map KV lookup failed:', err);
    }
  }

  // Fallback: standard chat → active instance.
  if (!instanceId) {
    instanceId = await env.SESSIONS.get(`tg:chat:${chatId}`);
  }
  if (!instanceId) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: chatId,
      text: 'This chat is not linked. In PATAPIM go to Preferences → Notifications → Telegram and click "Connect to Telegram".',
    });
    return;
  }
  if (originTerminalId) {
    (msg as any)._patapim_terminal_id = originTerminalId;
  }

  // Voice/audio: two paths depending on duration.
  //   - dur <= SHORT: download bytes, ship inline as base64. PATAPIM transcribes
  //     locally with Parakeet (good latency, free), falls back to Workers AI
  //     Whisper via the `transcribe_voice` WS handler if Parakeet fails.
  //   - SHORT < dur <= MAX: too big to ship inline reliably, so we transcribe
  //     here with Workers AI Whisper-large-v3-turbo and forward the transcript
  //     as msg.text (with a flag the listener picks up to mirror the voice
  //     echo lifecycle — user still sees "🎤 <transcript>").
  //   - dur > MAX: reject.
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

  // If the user replied to a previous bot message and we have a stored
  // (instance, terminal) binding for that message_id, attach the terminal_id
  // directly on the inbound update. The PATAPIM listener consumes
  // `_patapim_terminal_id` and routes home — survives client restarts and
  // beats the route-toggle fallback. Binding is scoped by chat_id +
  // instance_id to avoid cross-install/cross-chat leakage.
  const replyTo = msg.reply_to_message;
  if (replyTo && replyTo.message_id) {
    try {
      const stored = await env.SESSIONS.get(`tg:msg:${chatId}:${replyTo.message_id}`);
      if (stored) {
        const parsed = JSON.parse(stored) as { instance_id?: string; terminal_id?: string };
        if (parsed.instance_id === instanceId && parsed.terminal_id) {
          (msg as any)._patapim_terminal_id = parsed.terminal_id;
        }
      }
    } catch {
      // KV miss / parse error → fall through to client-side fallback routing.
    }
  }

  const doStub = env.TELEGRAM_INSTANCE.get(env.TELEGRAM_INSTANCE.idFromName(instanceId));
  await doStub.fetch('https://do/__internal/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ update }),
  });
}

async function routeCallbackQuery(cq: NonNullable<TelegramUpdate['callback_query']>, env: any) {
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  if (!chatId) return;

  // No binding for this chat → nothing to forward to. Ack so the spinner
  // clears, but don't expose any UX detail.
  const instanceId = await env.SESSIONS.get(`tg:chat:${chatId}`);
  if (!instanceId) {
    await tgAnswerCallback(env.TELEGRAM_BOT_TOKEN, cq.id, 'This chat is not linked.', true).catch(() => {});
    return;
  }

  // Look up the per-message binding so the DO can attach _patapim_terminal_id
  // before forwarding. The tap might be on a message older than the in-memory
  // messageMap on the client; this KV (7-day TTL) is the source of truth.
  let terminalId = '';
  if (messageId) {
    try {
      const stored = await env.SESSIONS.get(`tg:msg:${chatId}:${messageId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as { instance_id?: string; terminal_id?: string };
        if (parsed.instance_id === instanceId && parsed.terminal_id) {
          terminalId = parsed.terminal_id;
        }
      }
    } catch {
      // KV miss / parse error → forward without terminal_id; client will use
      // the terminalId encoded in cq.data (`plan:<terminalId>:<N>`).
    }
  }

  // Mutate a shallow copy of the update so the DO/client receive the binding.
  const cqOut = terminalId
    ? { ...cq, message: cq.message ? { ...cq.message, _patapim_terminal_id: terminalId } : cq.message }
    : cq;

  const doStub = env.TELEGRAM_INSTANCE.get(env.TELEGRAM_INSTANCE.idFromName(instanceId));
  await doStub.fetch('https://do/__internal/callback_query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query: cqOut }),
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
