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

  // Extract IP and geolocation from Cloudflare headers
  const ip = context.request.headers.get('CF-Connecting-IP') || undefined;
  const cf = (context.request as any).cf;
  const city = cf?.city || undefined;
  const country = cf?.country || undefined;

  // Check if tunnel/terminal data changed
  const dataChanged =
    (body.tunnelUrl !== undefined && body.tunnelUrl !== device.tunnelUrl) ||
    (body.terminalCount !== undefined && body.terminalCount !== device.terminalCount);

  // Check if geo data changed
  const geoChanged =
    (ip !== undefined && ip !== device.ip) ||
    (city !== undefined && city !== device.city) ||
    (country !== undefined && country !== device.country);

  if (dataChanged || geoChanged) {
    device.lastSeen = new Date().toISOString();
    if (body.tunnelUrl !== undefined) device.tunnelUrl = body.tunnelUrl;
    if (body.terminalCount !== undefined) device.terminalCount = body.terminalCount;
    if (ip !== undefined) device.ip = ip;
    if (city !== undefined) device.city = city;
    if (country !== undefined) device.country = country;
    await env.LICENSES.put(`device:${deviceToken}`, JSON.stringify(device));
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
