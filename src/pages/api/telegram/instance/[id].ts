/**
 * Per-instance WebSocket upgrade endpoint (legacy v1).
 *
 * A PATAPIM install opens wss://patapim.ai/api/telegram/instance/<id> and stays
 * connected while running. The TelegramInstance Durable Object handles the
 * socket lifecycle directly (hibernating when idle).
 *
 * Superseded by the authenticated, account-keyed v2 path (`v2/connect.ts` →
 * TelegramAccount). This endpoint remains only for lingering v1 clients.
 *
 * SECURITY: this endpoint previously accepted ANY connection that knew the
 * instance UUID — no authentication. That allowed:
 *   (a) anyone to burn the Cloudflare account's Workers AI quota by connecting
 *       to a throwaway UUID and spamming `transcribe_voice`, and
 *   (b) anyone who leaked a real instance UUID to drive that user's Telegram
 *       relay (request pairing, send messages to the paired chat).
 * We now require a valid device bearer token (same check as v2/connect) and
 * bind each instance UUID to the first authenticated owner email (TOFU); a
 * different account cannot attach to someone else's instance. The relay client
 * already sends `Authorization: Bearer <deviceToken>` on every connect, so this
 * does not break legacy v1 clients.
 */

import type { APIRoute } from 'astro';

export const prerender = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseInstanceId(id: string): string | null {
  if (!UUID_RE.test(id)) return null;
  return id.toLowerCase();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function handle(context: any): Promise<Response> {
  const env = context.locals.runtime.env;
  const request = context.request as Request;
  const id = String(context.params.id || '');

  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('expected websocket upgrade', { status: 426 });
  }

  const instanceId = parseInstanceId(id);
  if (!instanceId) {
    return new Response('invalid instance id', { status: 400 });
  }

  // --- authenticate the device token (mirrors v2/connect) ---
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return new Response('missing bearer token', { status: 401 });

  const raw = await env.LICENSES.get(`device:${token}`);
  if (!raw) return new Response('invalid token', { status: 401 });

  let email = '';
  try {
    email = normalizeEmail((JSON.parse(raw) as { email?: string }).email || '');
  } catch {
    return new Response('invalid token payload', { status: 401 });
  }
  if (!email) return new Response('token has no email', { status: 401 });

  // --- bind instance UUID -> owner email (trust on first authenticated use) ---
  const ownerKey = `tg:v1-owner:${instanceId}`;
  const owner = await env.SESSIONS.get(ownerKey);
  if (owner === null) {
    await env.SESSIONS.put(ownerKey, email);
  } else if (owner !== email) {
    return new Response('instance belongs to another account', { status: 403 });
  }

  const doId = env.TELEGRAM_INSTANCE.idFromName(instanceId);
  const stub = env.TELEGRAM_INSTANCE.get(doId);
  return stub.fetch(request);
}

export const GET: APIRoute = (ctx) => handle(ctx);
