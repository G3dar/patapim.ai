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
import { sendMessage } from '../../../lib/telegram/bot-api';
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

  // Any other message: look up the chat's instance and forward.
  const instanceId = await env.SESSIONS.get(`tg:chat:${chatId}`);
  if (!instanceId) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, {
      chat_id: chatId,
      text: 'This chat is not linked. In PATAPIM go to Preferences → Notifications → Telegram and click "Connect to Telegram".',
    });
    return;
  }

  // Voice/audio: download the bytes here (only the relay has the bot token in
  // official mode) and forward inline to PATAPIM. PATAPIM transcribes locally
  // with Parakeet first, falls back to Workers AI Whisper via the
  // `transcribe_voice` WS handler if Parakeet decode/transcribe fails.
  if (msg.voice || msg.audio) {
    const file = msg.voice || msg.audio;
    if (file && file.file_id && (file.duration || 0) <= 120) {
      try {
        const audioBuf = await downloadTelegramFile(env, file.file_id);
        // Tunnel raw bytes inside the update — the listener picks them off.
        // base64 keeps the wire format JSON-compatible; ~33% overhead is fine
        // for voice <= 120s (typically <300KB raw).
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
    } else if (file && (file.duration || 0) > 120) {
      await sendMessage(env.TELEGRAM_BOT_TOKEN, {
        chat_id: chatId,
        reply_to_message_id: msg.message_id,
        text: '🎤 Voice messages over 2 min are not supported. Trim it down.',
      });
      return;
    }
  }

  const doStub = env.TELEGRAM_INSTANCE.get(env.TELEGRAM_INSTANCE.idFromName(instanceId));
  await doStub.fetch('https://do/__internal/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ update }),
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
