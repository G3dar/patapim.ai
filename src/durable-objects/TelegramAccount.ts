/**
 * TelegramAccount Durable Object
 *
 * One instance per PATAPIM *account*, addressed by the account email (v2 model).
 * Supersedes the per-install TelegramInstance for accounts that have migrated:
 * a single Telegram chat pairing is shared across all of a user's installs, and
 * one install at a time is the "active" receiver.
 *
 * Holds:
 *   - email (account identity)
 *   - chat_id binding (once paired)
 *   - short-lived pairing code
 *   - per-install presence map (instances) + the active_instance_id
 *   - offline message queue (while no install is connected)
 *   - hibernating WebSockets, one per connected install of the account
 *
 * Cross-DO chat→account mapping lives in env.SESSIONS (KV), keyed as
 * `tg:chat-v2:{chatId}` → email. Written when /start completes pairing,
 * deleted on /unlink. Pairing codes live at `tg:pair-v2:{code}` → email.
 * Outbound message routing map lives at `tg:msg-v2:{chatId}:{messageId}`.
 *
 * NOTE: This file was recovered from the deployed Cloudflare Worker bundle —
 * the original source was lost from version control. It is a faithful
 * transcription of the live production class.
 */

import { DurableObject } from 'cloudflare:workers';
import {
  sendMessage,
  callBotApi,
  answerCallbackQuery,
  editMessageText,
  editMessageReplyMarkup,
  type TelegramUpdate,
} from '../lib/telegram/bot-api';

const PAIR_CODE_TTL_MS = 5 * 60 * 1000;
const MAX_QUEUED = 100;
const QUEUE_TTL_MS = 7 * 24 * 3600 * 1000;
// Drop an install's presence entry if we haven't seen it reconnect in 30 days.
const INSTANCE_PRESENCE_TTL_MS = 30 * 24 * 3600 * 1000;

const BOT_USERNAME = 'botpatapimbot';

function randomPairCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  for (let i = 0; i < length; i++) out += chars[buf[i] % chars.length];
  return out;
}

interface PairingEntry {
  code: string;
  expires_at: number;
}

interface InstancePresence {
  name: string;
  last_seen: number;
}

interface AccountState {
  email: string;
  chat_id: number | null;
  chat_id_hint: string;
  paired_at: string | null;
  pairing: PairingEntry | null;
  instances: Record<string, InstancePresence>;
  active_instance_id: string | null;
}

interface QueuedMessage {
  ts: number;
  update: TelegramUpdate;
  // When set, only the install with this instance_id may receive the entry
  // (a reply/callback bound to a specific machine). Absent = untargeted.
  target_instance_id?: string;
}

interface SocketAttachment {
  instance_id?: string;
  instance_name?: string;
}

interface AccountEnv {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  SESSIONS: KVNamespace;
  SITE_URL: string;
  AI: Ai;
  // Self-binding so the Worker can route to a peer account DO.
  TELEGRAM_ACCOUNT: DurableObjectNamespace;
}

export class TelegramAccount extends DurableObject<AccountEnv> {
  private sockets: WebSocket[] = [];

  constructor(state: DurableObjectState, env: AccountEnv) {
    super(state, env);
    this.sockets = this.ctx.getWebSockets();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleUpgrade(request);
    }
    switch (url.pathname) {
      case '/__internal/pair-complete':
        return this.internalPairComplete(request);
      case '/__internal/message':
        return this.internalDeliverMessage(request);
      case '/__internal/callback_query':
        return this.internalDeliverCallbackQuery(request);
      case '/__internal/status':
        return this.internalStatus();
      default:
        return new Response('not found', { status: 404 });
    }
  }

  // ---------- WebSocket lifecycle ----------
  async handleUpgrade(request: Request): Promise<Response> {
    const email = (request.headers.get('X-Patapim-Email') || '').toLowerCase().trim();
    const instanceId = (request.headers.get('X-Patapim-Instance') || '').toLowerCase().trim();
    const instanceName = request.headers.get('X-Patapim-Instance-Name') || '';
    if (!email || !instanceId) {
      return new Response('missing identity headers', { status: 400 });
    }
    const state = await this.loadState();
    if (!state.email) {
      state.email = email;
    }
    state.instances[instanceId] = { name: instanceName, last_seen: Date.now() };
    const cutoff = Date.now() - INSTANCE_PRESENCE_TTL_MS;
    for (const [id, p] of Object.entries(state.instances)) {
      if (id !== instanceId && p.last_seen < cutoff) delete state.instances[id];
    }
    await this.ctx.storage.put('state', state);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.serializeAttachment({ instance_id: instanceId, instance_name: instanceName });
    this.ctx.acceptWebSocket(server);
    this.sockets = this.ctx.getWebSockets();
    server.send(JSON.stringify({
      type: 'hello_ack',
      paired: !!state.chat_id,
      chat_id_hint: state.chat_id_hint || '',
      active_instance_id: state.active_instance_id,
      instance_count: Object.keys(state.instances).length,
    }));
    // Unconditional: targeted entries must reach their owning install even
    // when it isn't the active one. drainQueueFor gates untargeted entries
    // on the active role internally.
    await this.drainQueueFor(server, instanceId);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: ArrayBuffer | string): Promise<void> {
    const raw = typeof data === 'string' ? data : new TextDecoder().decode(data);
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const id = msg.id;
    const type = msg.type;
    const att: SocketAttachment = ws.deserializeAttachment() || {};
    try {
      switch (type) {
        case 'hello':
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
            parse_mode: msg.parse_mode || 'HTML',
            disable_notification: !!msg.disable_notification,
            reply_to_message_id: msg.reply_to_message_id,
            reply_markup: msg.reply_markup,
          };
          const sent = await sendMessage(this.env.TELEGRAM_BOT_TOKEN, params);
          const terminalId = msg.terminal_id ? String(msg.terminal_id) : '';
          if (sent.message_id && terminalId && state.email && att.instance_id) {
            try {
              await this.env.SESSIONS.put(
                `tg:msg-v2:${sent.chat.id}:${sent.message_id}`,
                JSON.stringify({
                  email: state.email,
                  instance_id: att.instance_id,
                  terminal_id: terminalId,
                  boot_id: msg.boot_id ? String(msg.boot_id) : '',
                }),
                { expirationTtl: 30 * 24 * 3600 },
              );
            } catch (err) {
              console.warn('[TelegramAccount] msg-map KV put failed:', err);
            }
          }
          if (id) ws.send(JSON.stringify({
            id,
            type: 'ack',
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
          const result = await this.claimActiveInternal(att.instance_id);
          if (id) ws.send(JSON.stringify({ id, type: 'ack', result }));
          return;
        }
        case 'set_reaction': {
          const state = await this.loadState();
          if (!state.chat_id) throw new Error('Not paired — no chat_id to react in.');
          const message_id = Number(msg.message_id);
          if (!message_id) throw new Error('message_id is required');
          const emoji = String(msg.emoji || '').trim();
          const reactions = emoji ? [{ type: 'emoji', emoji }] : [];
          await callBotApi(this.env.TELEGRAM_BOT_TOKEN, 'setMessageReaction', {
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
          await answerCallbackQuery(
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
          const requestedChatId = Number(msg.chat_id);
          const chatId = state.chat_id;
          if (!chatId) throw new Error('Not paired — no chat_id to edit in.');
          if (!requestedChatId || requestedChatId !== chatId) {
            throw new Error('chat_id must match the paired chat');
          }
          const message_id = Number(msg.message_id);
          if (!message_id) throw new Error('message_id is required');
          const text = String(msg.text || '').slice(0, 4000);
          await editMessageText(this.env.TELEGRAM_BOT_TOKEN, {
            chat_id: chatId,
            message_id,
            text,
            parse_mode: msg.parse_mode || 'HTML',
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
          await editMessageReplyMarkup(this.env.TELEGRAM_BOT_TOKEN, {
            chat_id: chatId,
            message_id,
            reply_markup: msg.reply_markup ?? { inline_keyboard: [] },
          });
          if (id) ws.send(JSON.stringify({ id, type: 'ack', result: { ok: true } }));
          return;
        }
        case 'transcribe_voice': {
          const b64 = String(msg.audio_b64 || '');
          if (!b64) throw new Error('audio_b64 is required');
          // Bound memory/cost: a voice clip is small. Reject oversized audio so
          // a peer can't exhaust DO memory (the byte spread below allocates a
          // number array) or burn Workers AI quota with huge payloads.
          if (b64.length > 10 * 1024 * 1024) throw new Error('audio too large');
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
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

  async webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    this.sockets = this.ctx.getWebSockets();
  }

  async webSocketError(_ws: WebSocket, _error: unknown): Promise<void> {
    this.sockets = this.ctx.getWebSockets();
  }

  // ---------- Internal RPC from Worker ----------
  async internalPairComplete(request: Request): Promise<Response> {
    const { chat_id, chat_id_hint } = await request.json() as { chat_id: number; chat_id_hint?: string };
    const state = await this.loadState();
    state.chat_id = chat_id;
    state.chat_id_hint = chat_id_hint || '';
    state.paired_at = new Date().toISOString();
    state.pairing = null;
    await this.ctx.storage.put('state', state);
    this.broadcast({ type: 'paired', chat_id_hint: state.chat_id_hint });
    return new Response('ok');
  }

  /**
   * Mark `instanceId` as the active receiver. Notify other sockets (different
   * instance) via active_lost so their UI toggles match. Idempotent.
   */
  async claimActiveInternal(instanceId: string | undefined): Promise<{ ok: boolean; was_active: boolean; previous_instance: string | null }> {
    if (!instanceId) throw new Error('instance_id missing on socket attachment');
    const state = await this.loadState();
    if (!state.chat_id) throw new Error('Not paired — cannot claim active.');
    const previous = state.active_instance_id;
    if (previous === instanceId) {
      return { ok: true, was_active: true, previous_instance: previous };
    }
    state.active_instance_id = instanceId;
    await this.ctx.storage.put('state', state);
    if (previous) {
      for (const ws of this.sockets) {
        const att: SocketAttachment = ws.deserializeAttachment() || {};
        if (att.instance_id === previous) {
          try {
            ws.send(JSON.stringify({ type: 'active_lost' }));
          } catch {
          }
        }
      }
    }
    return { ok: true, was_active: false, previous_instance: previous };
  }

  async internalDeliverMessage(request: Request): Promise<Response> {
    const { update, target_instance_id } = await request.json() as {
      update: TelegramUpdate;
      target_instance_id?: string;
    };
    const target = target_instance_id || '';
    const delivered = await this.deliverInbound({ type: 'message', update }, target);
    if (!delivered) {
      const entry: QueuedMessage = { ts: Date.now(), update };
      if (target) entry.target_instance_id = target;
      await this.enqueue(entry);
      if (target) {
        await this.notifyTargetOffline(target, update);
      }
    }
    return new Response(JSON.stringify({ delivered }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async internalDeliverCallbackQuery(request: Request): Promise<Response> {
    const { callback_query, target_instance_id } = await request.json() as {
      callback_query: any;
      target_instance_id?: string;
    };
    const target = target_instance_id || '';
    const delivered = await this.deliverInbound({ type: 'callback_query', update: callback_query }, target);
    if (!delivered) {
      let toast = 'PATAPIM is offline — open the app and try again.';
      if (target) {
        const state = await this.loadState();
        const name = state.instances[target]?.name;
        toast = name
          ? `"${name}" is offline — open PATAPIM there and tap again.`
          : 'That machine is offline — open PATAPIM there and tap again.';
      }
      try {
        await answerCallbackQuery(this.env.TELEGRAM_BOT_TOKEN, callback_query.id, toast, true);
      } catch {
      }
    }
    return new Response(JSON.stringify({ delivered }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Best-effort Telegram feedback when a reply bound to a specific install
   * couldn't be delivered because that install has no live socket. Without
   * this the user would assume the reply landed somewhere.
   */
  async notifyTargetOffline(targetInstanceId: string, update: TelegramUpdate): Promise<void> {
    try {
      const state = await this.loadState();
      if (!state.chat_id) return;
      const name = state.instances[targetInstanceId]?.name;
      const text = name
        ? `⏳ That terminal lives on "${name}", which is offline right now. Your reply is queued and will be delivered when it reconnects (kept up to 7 days). To reach the active terminal instead, send the message without replying.`
        : `⚠️ That terminal belongs to a PATAPIM instance that is no longer registered. Open PATAPIM on that machine to receive the queued reply, or send the message without replying to reach the active terminal.`;
      await sendMessage(this.env.TELEGRAM_BOT_TOKEN, {
        chat_id: state.chat_id,
        reply_to_message_id: (update as any)?.message?.message_id,
        text,
      });
    } catch (err) {
      console.warn('[TelegramAccount] offline-feedback send failed:', err);
    }
  }

  async internalStatus(): Promise<Response> {
    const state = await this.loadState();
    return new Response(JSON.stringify({
      connected: this.sockets.length > 0,
      paired: !!state.chat_id,
      chat_id_hint: state.chat_id_hint,
      paired_at: state.paired_at,
      active_instance_id: state.active_instance_id,
      instance_count: Object.keys(state.instances).length,
      queue_size: (await this.getQueue()).length,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // ---------- Helpers ----------
  /**
   * Deliver to the active instance's sockets first; if none connected, fall
   * back to any live socket so the message isn't lost. Returns true iff at
   * least one socket received the frame.
   *
   * With targetInstanceId set (reply/callback bound to a specific install),
   * ONLY that install's sockets are eligible — no active/any-socket fallback;
   * the caller queues the frame for that instance instead.
   */
  async deliverInbound(payload: { type: string; update: unknown }, targetInstanceId = ''): Promise<boolean> {
    const frame = JSON.stringify(payload);
    this.sockets = this.ctx.getWebSockets();
    if (this.sockets.length === 0) return false;
    if (targetInstanceId) {
      let delivered = false;
      for (const ws of this.sockets) {
        const att: SocketAttachment = ws.deserializeAttachment() || {};
        if (att.instance_id === targetInstanceId) {
          try {
            ws.send(frame);
            delivered = true;
          } catch {
          }
        }
      }
      return delivered;
    }
    const state = await this.loadState();
    const active = state.active_instance_id;
    let delivered = false;
    if (active) {
      for (const ws of this.sockets) {
        const att: SocketAttachment = ws.deserializeAttachment() || {};
        if (att.instance_id === active) {
          try {
            ws.send(frame);
            delivered = true;
          } catch {
          }
        }
      }
    }
    if (!delivered) {
      for (const ws of this.sockets) {
        try {
          ws.send(frame);
          delivered = true;
          break;
        } catch {
        }
      }
    }
    return delivered;
  }

  async loadState(): Promise<AccountState> {
    const stored = await this.ctx.storage.get<AccountState>('state');
    return stored || {
      email: '',
      chat_id: null,
      chat_id_hint: '',
      paired_at: null,
      pairing: null,
      instances: {},
      active_instance_id: null,
    };
  }

  async generatePairingCode(): Promise<{ code: string; deeplink: string; expires_at: number; bot_username: string }> {
    const state = await this.loadState();
    if (!state.email) {
      throw new Error('Account email not yet bound — reconnect before requesting pairing.');
    }
    const code = randomPairCode(6);
    const expires_at = Date.now() + PAIR_CODE_TTL_MS;
    state.pairing = { code, expires_at };
    await this.ctx.storage.put('state', state);
    await this.env.SESSIONS.put(`tg:pair-v2:${code}`, state.email, {
      expirationTtl: Math.ceil(PAIR_CODE_TTL_MS / 1000),
    });
    return {
      code,
      deeplink: `https://t.me/${BOT_USERNAME}?start=${code}`,
      expires_at,
      bot_username: BOT_USERNAME,
    };
  }

  async unlinkInternal(): Promise<void> {
    const state = await this.loadState();
    if (state.chat_id) {
      await this.env.SESSIONS.delete(`tg:chat-v2:${state.chat_id}`);
    }
    state.chat_id = null;
    state.chat_id_hint = '';
    state.paired_at = null;
    state.pairing = null;
    state.active_instance_id = null;
    await this.ctx.storage.put('state', state);
    await this.ctx.storage.delete('queue');
    this.broadcast({ type: 'unpaired' });
  }

  broadcast(payload: unknown): boolean {
    const frame = JSON.stringify(payload);
    let delivered = false;
    for (const ws of this.sockets) {
      try {
        ws.send(frame);
        delivered = true;
      } catch {
      }
    }
    return delivered;
  }

  async getQueue(): Promise<QueuedMessage[]> {
    const queue = await this.ctx.storage.get<QueuedMessage[]>('queue');
    if (!queue) return [];
    const cutoff = Date.now() - QUEUE_TTL_MS;
    return queue.filter((e) => e.ts >= cutoff);
  }

  async enqueue(entry: QueuedMessage): Promise<void> {
    const queue = await this.getQueue();
    queue.push(entry);
    while (queue.length > MAX_QUEUED) queue.shift();
    await this.ctx.storage.put('queue', queue);
  }

  /**
   * Flush queued entries to a freshly-connected install. Entries targeted at
   * this instance always flush; untargeted entries flush only when this
   * instance is (or can become) the active receiver — the pre-targeting
   * behavior. Everything else stays queued for its owner.
   */
  async drainQueueFor(ws: WebSocket, instanceId: string): Promise<void> {
    const queue = await this.getQueue();
    if (!queue.length) return;
    const state = await this.loadState();
    const takesUntargeted = !state.active_instance_id || state.active_instance_id === instanceId;
    const keep: QueuedMessage[] = [];
    for (const entry of queue) {
      const target = entry.target_instance_id || '';
      const mine = target ? target === instanceId : takesUntargeted;
      if (!mine) {
        keep.push(entry);
        continue;
      }
      try {
        ws.send(JSON.stringify({ type: 'message', update: entry.update }));
      } catch {
        keep.push(entry);
      }
    }
    if (keep.length) {
      await this.ctx.storage.put('queue', keep);
    } else {
      await this.ctx.storage.delete('queue');
    }
  }
}
