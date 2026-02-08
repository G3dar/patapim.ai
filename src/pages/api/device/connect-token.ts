import type { APIRoute } from 'astro';
import { getUserFromRequest } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const headers = { 'Content-Type': 'application/json' };

  // Session auth (user must be logged in via cookie)
  const user = await getUserFromRequest(env.SESSIONS, context.request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  let body: { deviceToken?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const { deviceToken } = body;
  if (!deviceToken) {
    return new Response(JSON.stringify({ error: 'deviceToken required' }), { status: 400, headers });
  }

  // Verify device exists and belongs to this user
  const raw = await env.LICENSES.get(`device:${deviceToken}`);
  if (!raw) {
    return new Response(JSON.stringify({ error: 'Device not found' }), { status: 404, headers });
  }

  const device = JSON.parse(raw);
  if (device.googleId !== user.googleId) {
    return new Response(JSON.stringify({ error: 'Device does not belong to this user' }), { status: 403, headers });
  }

  // Check device is online and has a tunnel URL
  if (!device.tunnelUrl) {
    return new Response(JSON.stringify({ error: 'Device is not online or tunnel not available' }), { status: 400, headers });
  }

  // Generate one-time connect token
  const connectToken = crypto.randomUUID();

  // Store in KV with 5-minute TTL
  await env.SESSIONS.put(`connect:${connectToken}`, JSON.stringify({
    googleId: user.googleId,
    email: user.email,
    deviceToken,
    createdAt: new Date().toISOString(),
  }), { expirationTtl: 300 });

  return new Response(JSON.stringify({
    connectToken,
    tunnelUrl: device.tunnelUrl,
    expiresIn: 300,
  }), { status: 200, headers });
};
