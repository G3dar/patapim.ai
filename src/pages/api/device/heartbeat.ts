import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

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

  let body: { tunnelUrl?: string; terminalCount?: number } = {};
  try {
    body = await context.request.json();
  } catch {}

  const device = JSON.parse(raw);

  // Only write to KV when tunnelUrl or terminalCount actually changes.
  // Online status is detected client-side by pinging the device's tunnel URL directly.
  const dataChanged =
    (body.tunnelUrl !== undefined && body.tunnelUrl !== device.tunnelUrl) ||
    (body.terminalCount !== undefined && body.terminalCount !== device.terminalCount);

  if (dataChanged) {
    device.lastSeen = new Date().toISOString();
    if (body.tunnelUrl !== undefined) device.tunnelUrl = body.tunnelUrl;
    if (body.terminalCount !== undefined) device.terminalCount = body.terminalCount;
    await env.LICENSES.put(`device:${deviceToken}`, JSON.stringify(device));
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
