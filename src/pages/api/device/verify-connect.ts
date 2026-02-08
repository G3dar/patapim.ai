import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  // Bearer token auth (device token)
  const auth = context.request.headers.get('Authorization');
  const deviceToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!deviceToken) {
    return new Response(JSON.stringify({ valid: false, error: 'Unauthorized' }), { status: 401, headers });
  }

  // Verify device exists
  const deviceRaw = await env.LICENSES.get(`device:${deviceToken}`);
  if (!deviceRaw) {
    return new Response(JSON.stringify({ valid: false, error: 'Device not found' }), { status: 404, headers });
  }

  const device = JSON.parse(deviceRaw);

  let body: { connectToken?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ valid: false, error: 'Invalid JSON' }), { status: 400, headers });
  }

  const { connectToken } = body;
  if (!connectToken) {
    return new Response(JSON.stringify({ valid: false, error: 'connectToken required' }), { status: 400, headers });
  }

  // Look up connect token
  const connectRaw = await env.SESSIONS.get(`connect:${connectToken}`);
  if (!connectRaw) {
    return new Response(JSON.stringify({ valid: false, error: 'Invalid or expired connect token' }), { status: 200, headers });
  }

  const connectData = JSON.parse(connectRaw);

  // Verify the connect token's googleId matches the device's owner
  if (connectData.googleId !== device.googleId) {
    return new Response(JSON.stringify({ valid: false, error: 'Token does not match device owner' }), { status: 200, headers });
  }

  // Verify the connect token was issued for this device
  if (connectData.deviceToken !== deviceToken) {
    return new Response(JSON.stringify({ valid: false, error: 'Token was not issued for this device' }), { status: 200, headers });
  }

  // Delete the token (one-time use)
  await env.SESSIONS.delete(`connect:${connectToken}`);

  return new Response(JSON.stringify({
    valid: true,
    googleId: connectData.googleId,
    email: connectData.email,
  }), { status: 200, headers });
};
