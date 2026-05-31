import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

const MAX_BODY_BYTES = 64 * 1024;
const RETENTION_SECONDS = 60 * 60 * 24 * 14;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  const auth = context.request.headers.get('Authorization');
  const deviceToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!deviceToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const deviceRaw = await env.LICENSES.get(`device:${deviceToken}`);
  if (!deviceRaw) {
    return new Response(JSON.stringify({ error: 'Device not found' }), { status: 404, headers });
  }
  const device = JSON.parse(deviceRaw);

  const text = await context.request.text();
  if (text.length > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: 'Report too large' }), { status: 413, headers });
  }

  let report: unknown;
  try { report = JSON.parse(text); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const now = new Date().toISOString();
  const ip = context.request.headers.get('CF-Connecting-IP') || undefined;
  const cf = (context.request as any).cf;

  const stored = {
    receivedAt: now,
    googleId: device.googleId,
    email: device.email,
    deviceName: device.deviceName,
    sourceIp: ip,
    sourceCity: cf?.city || undefined,
    sourceCountry: cf?.country || undefined,
    report,
  };

  await env.LICENSES.put(`remote-doctor:${deviceToken}`, JSON.stringify(stored), {
    expirationTtl: RETENTION_SECONDS,
  });

  return new Response(JSON.stringify({ ok: true, receivedAt: now }), { status: 200, headers });
};
