/**
 * TelegramInstance Durable Object
 *
 * One instance per PATAPIM install, addressed by instance_id (UUID).
 * Holds:
 *   - chat_id binding (once paired)
 *   - short-lived pairing code
 *   - offline message queue (while PATAPIM is disconnected)
 *   - single hibernating WebSocket to the live PATAPIM process
 *
 * Wire protocol is defined in src/main/telegramRelay.js (PATAPIM side).
 *
 * Cross-DO chat→instance mapping lives in env.SESSIONS (KV), keyed as
 * `tg:chat:{chatId}` → instance_id. Written when /start completes pairing,
 * deleted on /unlink.
 */

import { DurableObject } from 'cloudflare:workers';
import {
  sendMessage as tgSendMessage,
  callBotApi as tgCallApi,
  answerCallbackQuery as tgAnswerCallback,
  editMessageText as tgEditMessageText,
  editMessageReplyMarkup as tgEditMessageReplyMarkup,
  type TelegramUpdate,
} from '../lib/telegram/bot-api';

const PAIR_CODE_TTL_MS = 5 * 60 * 1000;
const MAX_QUEUED = 100;
const QUEUE_TTL_MS = 7 * 24 * 3600 * 1000;

interface QueuedMessage {
  ts: number;
  update: TelegramUpdate;
}

interface PairingEntry {
  code: string;
  expires_at: number;
}

interface InstanceState {
  instance_id: string;
  chat_id: number | null;
  chat_id_hint: string;
  paired_at: string | null;
  pairing: PairingEntry | null;
}

interface RelayEnv {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  SESSIONS: KVNamespace;
  SITE_URL: string;
  AI: Ai;
  // Self-binding so a DO can call its peers (cross-instance active hand-off).
  TELEGRAM_INSTANCE: DurableObjectNamespace;
}

const BOT_USERNAME = 'botpatapimbot';

function randomPairCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  for (let i = 0; i < length; i++) out += chars[buf[i] % chars.length];
  return out;
}

export class TelegramInstance extends DurableObject<RelayEnv> {
  private sockets: WebSocket[] = [];

  constructor(state: DurableObjectState, env: RelayEnv) {
    super(state, env);
    // Rehydrate any sockets the runtime kept across hibernation.
    this.sockets = this.ctx.getWebSockets();
  }

  /** Entry point for incoming requests routed by the Worker. */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    // WebSocket upgrade from a PATAPIM instance
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleUpgrade(request);
    }
    // Internal RPC-style endpoints from the Worker (webhook handlers)
    switch (url.pathname) {
      case '/__internal/pair-complete':
        return this.internalPairComplete(request);
      case '/__internal/message':
        return this.internalDeliverMessage(request);
      case '/__internal/callback_query':
        return this.internalDeliverCallbackQuery(request);
      case '/__internal/status':
        return this.internalStatus();
      case '/__internal/active-lost':
        return this.internalActiveLost();
      default:
        return new Response('not found', { status: 404 });
    }
  }

  // ---------- WebSocket lifecycle ----------

  private async handleUpgrade(request: Request): Promise<Response> {
    // Extract the instance_id from the URL path and persist it on first
    // upgrade so the webhook can reach us via KV lookup.
    const url = new URL(request.url);
    const pathInstanceId = (url.pathname.match(/\/instance\/([0-9a-f-]+)/i) || [])[1] || '';
    const state = await this.loadState();
    if (!state.instance_id && pathInstanceId) {
      state.instance_id = pathInstanceId.toLowerCase();
      await this.ctx.storage.put('state', state);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    this.sockets = this.ctx.getWebSockets();
    // Tell the client the current pairing state up front.
    server.send(JSON.stringify({
      type: 'hello_ack',
      paired: !!state.chat_id,
      chat_id_hint: state.chat_id_hint || '',
    }));
    // Flush any queued messages.
    await this.flushQueue(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    const raw = typeof data === 'string' ? data : new TextDecoder().decode(data);
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(raw); } catch { return; }
    const id = msg.id as string | undefined;
    const type = msg.type as string;
    try {
      switch (type) {
        case 'hello':
          // Already handled at upgrade; noop.
          return;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
          return;
        case 'pong':
          return;
        case 'request_pairing': {
          const result = await this.generatePairingCode();
          if (id) ws.send(JSON.stringify({ id, type: 'ack', result }));
          return;
        }
        case 'send_message': {
          const state = await this.loadState();
          if (!state.chat_id) throw new Error('Not paired — no chat_id to send to.');
          const text = String(msg.text || '').slice(0, 4000);
          const params = {
            chat_id: state.chat_id,
            text,
            parse_mode: (msg.parse_mode as 'HTML' | 'MarkdownV2' | undefined) || 'HTML',
            disable_notification: !!msg.disable_notification,
            reply_to_message_id: msg.reply_to_message_id as number | undefined,
            // Pass through inline_keyboard / etc. for actionable notifications
            // (e.g. plan-ready URL buttons that deep-link to patapim.ai/remote).
            reply_markup: msg.reply_markup as unknown,
          };
          const sent = await tgSendMessage(this.env.TELEGRAM_BOT_TOKEN, params);
          // Persist message → (instance, terminal) so cross-instance replies
          // can route back to the originating terminal even after restart.
          // 30d TTL covers the long tail of useful replies.
          const terminalId = msg.terminal_id ? String(msg.terminal_id) : '';
          if (sent.message_id && state.instance_id && terminalId) {
            try {
              await this.env.SESSIONS.put(
                `tg:msg:${sent.chat.id}:${sent.message_id}`,
                JSON.stringify({ instance_id: state.instance_id, terminal_id: terminalId }),
                { expirationTtl: 30 * 24 * 3600 },
              );
            } catch (err) {
              console.warn('[TelegramInstance] msg-map KV put failed:', err);
            }
          }
          if (id) ws.send(JSON.stringify({
            id, type: 'ack',
            result: { message_id: sent.message_id, chat_id: sent.chat.id },
          }));
          return;
        }
        case 'unlink': {
          await this.unlinkInternal();
          if (id) ws.send(JSON.stringify({ id, type: 'ack', result: { ok: true } }));
          return;
        }
        case 'claim_active': {
          // Mark this instance as the active receiver for its chat. If another
          // instance was previously active, notify it via cross-DO call so it
          // can disable its airplane toggles. Idempotent — re-claiming the
          // already-active role is a no-op aside from confirming the binding.
          const result = await this.claimActiveInternal();
          if (id) ws.send(JSON.stringify({ id, type: 'ack', result }));
          return;
        }
        case 'set_reaction': {
          const state = await this.loadState();
          if (!state.chat_id) throw new Error('Not paired — no chat_id to react in.');
          const message_id = Number(msg.message_id);
          if (!message_id) throw new Error('message_id is required');
          const emoji = String(msg.emoji || '').trim();
          // Empty string clears the reaction; otherwise wrap the single emoji
          // in the expected ReactionType[] shape.
          const reactions = emoji ? [{ type: 'emoji', emoji }] : [];
          await tgCallApi(this.env.TELEGRAM_BOT_TOKEN, 'setMessageReaction', {
            chat_id: state.chat_id,
            message_id,
            reaction: reactions,
            is_big: false,
          });
          if (id) ws.send(JSON.stringify({ id, type: 'ack', result: { ok: true } }));
          return;
        }
        case 'answer_callback_query': {
          const callback_query_id = String(msg.callback_query_id || '');
          if (!callback_query_id) throw new Error('callback_query_id is required');
          await tgAnswerCallback(
            this.env.TELEGRAM_BOT_TOKEN,
            callback_query_id,
            String(msg.text || ''),
            !!msg.show_alert,
          );
          if (id) ws.send(JSON.stringify({ id, type: 'ack', result: { ok: true } }));
          return;
        }
        case 'edit_message_text': {
          const state = await this.loadState();
          // Allow either an explicit chat_id from the client OR fall back to
          // the bound chat_id. PATAPIM passes chat_id explicitly because edits
          // can target any tracked message; pin to the paired chat to avoid
          // a malicious frame editing another chat by guessing IDs.
          const requestedChatId = Number(msg.chat_id);
          const chatId = state.chat_id;
          if (!chatId) throw new Error('Not paired — no chat_id to edit in.');
          if (!requestedChatId || requestedChatId !== chatId) {
            throw new Error('chat_id must match the paired chat');
          }
          const message_id = Number(msg.message_id);
          if (!message_id) throw new Error('message_id is required');
          const text = String(msg.text || '').slice(0, 4000);
          await tgEditMessageText(this.env.TELEGRAM_BOT_TOKEN, {
            chat_id: chatId,
            message_id,
            text,
            parse_mode: (msg.parse_mode as 'HTML' | 'MarkdownV2' | 'Markdown' | undefined) || 'HTML',
            reply_markup: msg.reply_markup,
          });
          if (id) ws.send(JSON.stringify({ id, type: 'ack', result: { ok: true } }));
          return;
        }
        case 'edit_message_reply_markup': {
          const state = await this.loadState();
          const requestedChatId = Number(msg.chat_id);
          const chatId = state.chat_id;
          if (!chatId) throw new Error('Not paired — no chat_id to edit in.');
          if (!requestedChatId || requestedChatId !== chatId) {
            throw new Error('chat_id must match the paired chat');
          }
          const message_id = Number(msg.message_id);
          if (!message_id) throw new Error('message_id is required');
          await tgEditMessageReplyMarkup(this.env.TELEGRAM_BOT_TOKEN, {
            chat_id: chatId,
            message_id,
            reply_markup: msg.reply_markup ?? { inline_keyboard: [] },
          });
          if (id) ws.send(JSON.stringify({ id, type: 'ack', result: { ok: true } }));
          return;
        }
        case 'transcribe_voice': {
          // PATAPIM's Whisper fallback when local Parakeet fails. Audio bytes
          // are sent base64 in `audio_b64`; we run Workers AI Whisper and
          // return the transcript.
          const b64 = String(msg.audio_b64 || '');
          if (!b64) throw new Error('audio_b64 is required');
          // Bound memory/cost: a voice clip is small. Reject oversized audio so
          // a peer can't exhaust DO memory (the byte spread below allocates a
          // number array) or burn Workers AI quota with huge payloads.
          if (b64.length > 10 * 1024 * 1024) throw new Error('audio too large');
          const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          const result = await this.env.AI.run(
            '@cf/openai/whisper-large-v3-turbo',
            { audio: [...bytes] },
          ) as { text?: string };
          const text = (result?.text || '').trim();
          if (id) ws.send(JSON.stringify({ id, type: 'ack', result: { text } }));
          return;
        }
        default:
          if (id) ws.send(JSON.stringify({ id, type: 'error', code: 'unknown_type', message: `unknown type: ${type}` }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (id) ws.send(JSON.stringify({ id, type: 'error', code: 'handler_threw', message }));
    }
  }

  async webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    this.sockets = this.ctx.getWebSockets();
  }

  async webSocketError(_ws: WebSocket, _error: unknown) {
    this.sockets = this.ctx.getWebSockets();
  }

  // ---------- Internal RPC from Worker ----------

  private async internalPairComplete(request: Request): Promise<Response> {
    const { chat_id, chat_id_hint } = await request.json() as { chat_id: number; chat_id_hint: string };
    const state = await this.loadState();
    state.chat_id = chat_id;
    state.chat_id_hint = chat_id_hint || '';
    state.paired_at = new Date().toISOString();
    state.pairing = null;
    await this.ctx.storage.put('state', state);
    // The webhook is responsible for setting tg:chat:<id> KV; if it just
    // overwrote a previous binding, notify the old instance so it can drop
    // its airplane toggles.
    this.broadcast({ type: 'paired', chat_id_hint: state.chat_id_hint });
    return new Response('ok');
  }

  private async internalActiveLost(): Promise<Response> {
    this.broadcast({ type: 'active_lost' });
    return new Response('ok');
  }

  /**
   * Re-binds tg:chat:<chat_id> KV to this instance, notifying the previously
   * active instance (if any and different) via cross-DO call so it can
   * disable its airplane toggles. Idempotent.
   */
  private async claimActiveInternal(): Promise<{ ok: boolean; was_active: boolean; previous_instance: string | null }> {
    const state = await this.loadState();
    if (!state.chat_id || !state.instance_id) {
      throw new Error('Not paired — cannot claim active.');
    }
    const key = `tg:chat:${state.chat_id}`;
    const previous = await this.env.SESSIONS.get(key);
    const myId = state.instance_id;
    if (previous === myId) {
      return { ok: true, was_active: true, previous_instance: previous };
    }
    await this.env.SESSIONS.put(key, myId);
    if (previous && previous !== myId) {
      try {
        const oldStub = this.env.TELEGRAM_INSTANCE.get(this.env.TELEGRAM_INSTANCE.idFromName(previous));
        await oldStub.fetch('https://do/__internal/active-lost', { method: 'POST' });
      } catch (err) {
        console.warn('[TelegramInstance] active-lost cross-DO failed:', err);
      }
    }
    return { ok: true, was_active: false, previous_instance: previous || null };
  }

  private async internalDeliverMessage(request: Request): Promise<Response> {
    const { update } = await request.json() as { update: TelegramUpdate };
    // Deliver live if possible, else enqueue.
    const delivered = this.broadcast({ type: 'message', update });
    if (!delivered) {
      await this.enqueue({ ts: Date.now(), update });
    }
    return new Response(JSON.stringify({ delivered }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Inline-button taps. Unlike messages we DON'T enqueue: a tap is only
  // meaningful in the live moment — replaying it after PATAPIM reconnects
  // hours later would press a stale plan option. If undelivered, we ack the
  // callback ourselves so the user's button stops spinning and gets a
  // visible "PATAPIM offline" toast.
  private async internalDeliverCallbackQuery(request: Request): Promise<Response> {
    const { callback_query } = await request.json() as { callback_query: NonNullable<TelegramUpdate['callback_query']> };
    const delivered = this.broadcast({ type: 'callback_query', update: callback_query });
    if (!delivered) {
      try {
        await tgAnswerCallback(this.env.TELEGRAM_BOT_TOKEN, callback_query.id, 'PATAPIM is offline — open the app and try again.', true);
      } catch {}
    }
    return new Response(JSON.stringify({ delivered }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async internalStatus(): Promise<Response> {
    const state = await this.loadState();
    return new Response(JSON.stringify({
      connected: this.sockets.length > 0,
      paired: !!state.chat_id,
      chat_id_hint: state.chat_id_hint,
      paired_at: state.paired_at,
      queue_size: (await this.getQueue()).length,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // ---------- Helpers ----------

  private async loadState(): Promise<InstanceState> {
    const stored = await this.ctx.storage.get<InstanceState>('state');
    return stored || {
      instance_id: '',
      chat_id: null,
      chat_id_hint: '',
      paired_at: null,
      pairing: null,
    };
  }

  private async generatePairingCode(): Promise<{ code: string; deeplink: string; expires_at: number; bot_username: string }> {
    const state = await this.loadState();
    if (!state.instance_id) {
      throw new Error('Instance ID not yet bound — reconnect before requesting pairing.');
    }
    const code = randomPairCode(6);
    const expires_at = Date.now() + PAIR_CODE_TTL_MS;
    state.pairing = { code, expires_at };
    await this.ctx.storage.put('state', state);
    // Webhook resolves /start <code> → instance_id via this KV entry.
    await this.env.SESSIONS.put(`tg:pair:${code}`, state.instance_id, {
      expirationTtl: Math.ceil(PAIR_CODE_TTL_MS / 1000),
    });
    return {
      code,
      deeplink: `https://t.me/${BOT_USERNAME}?start=${code}`,
      expires_at,
      bot_username: BOT_USERNAME,
    };
  }

  private async unlinkInternal(): Promise<void> {
    const state = await this.loadState();
    if (state.chat_id) {
      await this.env.SESSIONS.delete(`tg:chat:${state.chat_id}`);
    }
    state.chat_id = null;
    state.chat_id_hint = '';
    state.paired_at = null;
    state.pairing = null;
    await this.ctx.storage.put('state', state);
    await this.ctx.storage.delete('queue');
    this.broadcast({ type: 'unpaired' });
  }

  private broadcast(payload: unknown): boolean {
    const frame = JSON.stringify(payload);
    let delivered = false;
    for (const ws of this.sockets) {
      try {
        ws.send(frame);
        delivered = true;
      } catch {}
    }
    return delivered;
  }

  private async getQueue(): Promise<QueuedMessage[]> {
    const queue = await this.ctx.storage.get<QueuedMessage[]>('queue');
    if (!queue) return [];
    // Drop expired entries.
    const cutoff = Date.now() - QUEUE_TTL_MS;
    return queue.filter(e => e.ts >= cutoff);
  }

  private async enqueue(entry: QueuedMessage): Promise<void> {
    const queue = await this.getQueue();
    queue.push(entry);
    while (queue.length > MAX_QUEUED) queue.shift();
    await this.ctx.storage.put('queue', queue);
  }

  private async flushQueue(ws: WebSocket): Promise<void> {
    const queue = await this.getQueue();
    if (!queue.length) return;
    for (const entry of queue) {
      try {
        ws.send(JSON.stringify({ type: 'message', update: entry.update }));
      } catch {}
    }
    await this.ctx.storage.delete('queue');
  }
}
