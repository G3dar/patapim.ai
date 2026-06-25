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
  // Return version + kdf so the client can derive the decryption key (the kdf.salt
  // is non-secret and must be shared across devices for the same passphrase to
  // produce the same key). keys are encrypted envelopes for version >= 2.
  return new Response(JSON.stringify({
    version: data.version || 1,
    kdf: data.kdf || null,
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

  type EncEntry = { name: string; enc: 1; iv: string; ct: string; createdAt?: string; updatedAt?: string };
  let body: { version?: number; kdf?: { alg?: string; hash?: string; salt?: string; iterations?: number }; keys: EncEntry[]; updatedAt?: string } = { keys: [] };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  if (!Array.isArray(body.keys)) {
    return new Response(JSON.stringify({ error: 'keys must be an array' }), { status: 400, headers });
  }

  const updatedAt = new Date().toISOString();

  // Empty payload = clear all synced keys. No encryption needed.
  if (body.keys.length === 0) {
    await env.LICENSES.put(`apikeys:${googleId}`, JSON.stringify({ version: 2, updatedAt, kdf: body.kdf || null, keys: [] }));
    return new Response(JSON.stringify({ ok: true, updatedAt }), { status: 200, headers });
  }

  // Require client-side envelope encryption: every entry must be { name, enc:1,
  // iv, ct }. Reject any plaintext `value` so secrets are NEVER stored in the
  // clear at rest. Older clients that still send plaintext get a clear 400.
  const allEncrypted = body.keys.every(
    (k) => k && (k as EncEntry).enc === 1 && typeof (k as EncEntry).iv === 'string'
      && typeof (k as EncEntry).ct === 'string' && typeof k.name === 'string'
  );
  if (!allEncrypted) {
    return new Response(JSON.stringify({
      error: 'API keys must be client-side encrypted (enc:1, iv, ct). Update PATAPIM to a build with encrypted sync.',
      code: 'ENCRYPTION_REQUIRED',
    }), { status: 400, headers });
  }
  if (!body.kdf || typeof body.kdf.salt !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing kdf.salt for encrypted payload' }), { status: 400, headers });
  }

  // Store the encrypted envelopes verbatim — the server can't read the values.
  await env.LICENSES.put(`apikeys:${googleId}`, JSON.stringify({
    version: 2,
    updatedAt,
    kdf: body.kdf,
    keys: body.keys,
  }));

  return new Response(JSON.stringify({ ok: true, updatedAt }), { status: 200, headers });
};
