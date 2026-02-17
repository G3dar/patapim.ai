import type { APIRoute } from 'astro';
import { getUserFromRequest } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const headers = { 'Content-Type': 'application/json' };

  const user = await getUserFromRequest(env.SESSIONS, context.request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  let body: { deviceToken?: string; deviceName?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const { deviceToken } = body;
  if (!deviceToken) {
    return new Response(JSON.stringify({ error: 'deviceToken required' }), { status: 400, headers });
  }

  const deviceName = (body.deviceName || '').trim();
  if (!deviceName) {
    return new Response(JSON.stringify({ error: 'deviceName required' }), { status: 400, headers });
  }
  if (deviceName.length > 50) {
    return new Response(JSON.stringify({ error: 'deviceName too long (max 50 chars)' }), { status: 400, headers });
  }

  // Verify device belongs to this user
  const raw = await env.LICENSES.get(`device:${deviceToken}`);
  if (!raw) {
    return new Response(JSON.stringify({ error: 'Device not found' }), { status: 404, headers });
  }

  const device = JSON.parse(raw);
  if (device.googleId !== user.googleId) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers });
  }

  // Update device record
  device.deviceName = deviceName;
  await env.LICENSES.put(`device:${deviceToken}`, JSON.stringify(device));

  // Update device name in user's device list
  const devicesRaw = await env.LICENSES.get(`devices:${user.googleId}`);
  if (devicesRaw) {
    const devices = JSON.parse(devicesRaw);
    const entry = devices.find((d: any) => d.token === deviceToken);
    if (entry) {
      entry.deviceName = deviceName;
      await env.LICENSES.put(`devices:${user.googleId}`, JSON.stringify(devices));
    }
  }

  return new Response(JSON.stringify({ ok: true, deviceName }), { status: 200, headers });
};
