import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

/**
 * GET /api/device/api-keys — Pull synced API keys from cloud
 */
export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  // Bearer token auth
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

  const dataRaw = await env.LICENSES.get(`apikeys:${googleId}`);
  if (!dataRaw) {
    return new Response(JSON.stringify({ keys: [], updatedAt: null }), { status: 200, headers });
  }

  const data = JSON.parse(dataRaw);
  return new Response(JSON.stringify({
    keys: data.keys || [],
    updatedAt: data.updatedAt || null,
  }), { status: 200, headers });
};

/**
 * POST /api/device/api-keys — Push synced API keys to cloud
 */
export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  // Bearer token auth
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

  let body: { keys: Array<{ name: string; value: string; createdAt?: string; updatedAt?: string }>; updatedAt?: string } = { keys: [] };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  if (!Array.isArray(body.keys)) {
    return new Response(JSON.stringify({ error: 'keys must be an array' }), { status: 400, headers });
  }

  const updatedAt = new Date().toISOString();
  await env.LICENSES.put(`apikeys:${googleId}`, JSON.stringify({
    version: 1,
    updatedAt,
    keys: body.keys,
  }));

  return new Response(JSON.stringify({ ok: true, updatedAt }), { status: 200, headers });
};
