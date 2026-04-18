import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

const MAX_BYTES = 64 * 1024;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

/**
 * GET /api/device/custom-instructions — Pull synced custom instructions from cloud
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

  const dataRaw = await env.LICENSES.get(`customInstructions:${googleId}`);
  if (!dataRaw) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
  }

  const data = JSON.parse(dataRaw);
  return new Response(JSON.stringify({
    text: data.text || '',
    updatedAt: data.updatedAt || null,
    createdAt: data.createdAt || null,
    updatedFromInstance: data.updatedFromInstance || null,
  }), { status: 200, headers });
};

/**
 * POST /api/device/custom-instructions — Push synced custom instructions to cloud
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

  let body: { text?: string; updatedAt?: string | null; createdAt?: string | null; updatedFromInstance?: string | null } = {};
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const text = typeof body.text === 'string' ? body.text : '';
  const byteLen = new TextEncoder().encode(text).length;
  if (byteLen > MAX_BYTES) {
    return new Response(JSON.stringify({ error: 'Payload too large', maxBytes: MAX_BYTES }), { status: 413, headers });
  }

  const now = new Date().toISOString();
  const existingRaw = await env.LICENSES.get(`customInstructions:${googleId}`);
  const existing = existingRaw ? JSON.parse(existingRaw) : null;

  const updatedFromInstance =
    context.request.headers.get('X-Patapim-Instance') ||
    body.updatedFromInstance ||
    null;

  const updatedAt = body.updatedAt || now;
  const createdAt = existing?.createdAt || body.createdAt || now;

  await env.LICENSES.put(`customInstructions:${googleId}`, JSON.stringify({
    version: 1,
    text,
    updatedAt,
    createdAt,
    updatedFromInstance,
  }));

  return new Response(JSON.stringify({ ok: true, updatedAt, createdAt }), { status: 200, headers });
};
