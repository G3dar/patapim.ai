/**
 * Per-account WebSocket upgrade endpoint (v2).
 *
 * A PATAPIM install opens wss://patapim.ai/api/telegram/v2/connect with a
 * Bearer device token (?instance=<uuid>&name=<label>). We authenticate the
 * token against the LICENSES KV (`device:<token>` → { email }), resolve the
 * account's TelegramAccount DO by email, and forward the upgrade with the
 * caller's identity stamped into X-Patapim-* headers. The DO owns the socket
 * lifecycle (hibernating when idle).
 *
 * NOTE: this file was recovered from the deployed Cloudflare Worker bundle —
 * the original source was lost from version control. It is a faithful
 * transcription of the live production endpoint.
 */

import type { APIRoute } from 'astro';

export const prerender = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function handle(context: any): Promise<Response> {
  const env = context.locals.runtime.env;
  const request = context.request as Request;

  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('expected websocket upgrade', { status: 426 });
  }

  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return new Response('missing bearer token', { status: 401 });

  const raw = await env.LICENSES.get(`device:${token}`);
  if (!raw) return new Response('invalid token', { status: 401 });

  let email = '';
  try {
    const device = JSON.parse(raw) as { email?: string };
    email = normalizeEmail(device.email || '');
  } catch {
    return new Response('invalid token payload', { status: 401 });
  }
  if (!email) return new Response('token has no email', { status: 401 });

  const url = new URL(request.url);
  const instanceId = (url.searchParams.get('instance') || '').toLowerCase();
  if (!UUID_RE.test(instanceId)) {
    return new Response('invalid instance id', { status: 400 });
  }
  const instanceName = (url.searchParams.get('name') || '').slice(0, 80);

  const doId = env.TELEGRAM_ACCOUNT.idFromName(email);
  const stub = env.TELEGRAM_ACCOUNT.get(doId);

  const headers = new Headers(request.headers);
  headers.delete('Authorization');
  headers.set('X-Patapim-Email', email);
  headers.set('X-Patapim-Instance', instanceId);
  headers.set('X-Patapim-Instance-Name', instanceName);
  const fwd = new Request(request.url, { headers, method: request.method });
  return stub.fetch(fwd);
}

export const GET: APIRoute = (ctx) => handle(ctx);
