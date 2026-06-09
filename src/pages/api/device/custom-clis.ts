import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

// Generous cap — a list of small CLI definitions (name/command/icon). 50 CLIs
// of ~2KB each + metadata stays well under this.
const MAX_BYTES = 256 * 1024;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

/**
 * GET /api/device/custom-clis — Pull the account's synced custom CLI buttons.
 */
export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  const auth = context.request.headers.get('Authorization');
  const deviceToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!deviceToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const raw = await env.LICENSES.get(`device:${deviceToken}`);
  if (!raw) {
    return new Response(JSON.stringify({ error: 'Device not found' }), { status: 404, headers });
  }

  const device = JSON.parse(raw);
  const googleId = device.googleId;
  if (!googleId) {
    return new Response(JSON.stringify({ error: 'No Google account linked' }), { status: 400, headers });
  }

  const dataRaw = await env.LICENSES.get(`customCLIs:${googleId}`);
  if (!dataRaw) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
  }

  const data = JSON.parse(dataRaw);
  return new Response(JSON.stringify({
    clis: Array.isArray(data.clis) ? data.clis : [],
    updatedAt: data.updatedAt || null,
    createdAt: data.createdAt || null,
    updatedFromInstance: data.updatedFromInstance || null,
  }), { status: 200, headers });
};

/**
 * POST /api/device/custom-clis — Push the account's custom CLI buttons.
 */
export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  const auth = context.request.headers.get('Authorization');
  const deviceToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!deviceToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const raw = await env.LICENSES.get(`device:${deviceToken}`);
  if (!raw) {
    return new Response(JSON.stringify({ error: 'Device not found' }), { status: 404, headers });
  }

  const device = JSON.parse(raw);
  const googleId = device.googleId;
  if (!googleId) {
    return new Response(JSON.stringify({ error: 'No Google account linked' }), { status: 400, headers });
  }

  let body: {
    clis?: Array<{ id: string; name: string; command: string; iconId?: string; createdAt?: string | null; updatedAt?: string | null }>;
    updatedAt?: string | null;
    createdAt?: string | null;
    updatedFromInstance?: string | null;
  } = {};
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  if (!Array.isArray(body.clis)) {
    return new Response(JSON.stringify({ error: 'clis must be an array' }), { status: 400, headers });
  }

  const payload = JSON.stringify(body.clis);
  const byteLen = new TextEncoder().encode(payload).length;
  if (byteLen > MAX_BYTES) {
    return new Response(JSON.stringify({ error: 'Payload too large', maxBytes: MAX_BYTES }), { status: 413, headers });
  }

  const now = new Date().toISOString();
  const existingRaw = await env.LICENSES.get(`customCLIs:${googleId}`);
  const existing = existingRaw ? JSON.parse(existingRaw) : null;

  const updatedFromInstance =
    context.request.headers.get('X-Patapim-Instance') ||
    body.updatedFromInstance ||
    null;

  const updatedAt = body.updatedAt || now;
  const createdAt = existing?.createdAt || body.createdAt || now;

  await env.LICENSES.put(`customCLIs:${googleId}`, JSON.stringify({
    version: 1,
    clis: body.clis,
    updatedAt,
    createdAt,
    updatedFromInstance,
  }));

  return new Response(JSON.stringify({ ok: true, updatedAt, createdAt }), { status: 200, headers });
};
