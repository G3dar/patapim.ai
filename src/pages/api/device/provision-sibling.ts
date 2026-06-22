import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

// Mint a SIBLING device token under the same account as an existing device.
// Used by the PATAPIM dev instance (PATAPIM_INSTANCE=dev): it authenticates with
// the stable instance's device token and provisions its own token so it appears
// as a SEPARATE entry (e.g. "<host> [dev]") in patapim.ai/remote — same account,
// its own tunnel. The desktop persists the returned token, so this is called
// once (when the dev instance has no token yet), not on every launch.
export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  // Bearer auth with the PARENT (stable) device token.
  const auth = context.request.headers.get('Authorization');
  const parentToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!parentToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const parentRaw = await env.LICENSES.get(`device:${parentToken}`);
  if (!parentRaw) {
    return new Response(JSON.stringify({ error: 'Device not found' }), { status: 404, headers });
  }
  const parent = JSON.parse(parentRaw);
  if (!parent.googleId || !parent.email) {
    return new Response(JSON.stringify({ error: 'Device not found' }), { status: 404, headers });
  }

  let body: { deviceName?: string } = {};
  try { body = await context.request.json(); } catch {}

  // Sanitize the requested name; fall back to a clearly-dev default.
  const rawName = typeof body.deviceName === 'string' ? body.deviceName.trim().slice(0, 50) : '';
  const deviceName = rawName || 'PATAPIM Desktop [dev]';

  const now = new Date().toISOString();
  const deviceToken = crypto.randomUUID();

  await env.LICENSES.put(`device:${deviceToken}`, JSON.stringify({
    googleId: parent.googleId,
    email: parent.email,
    deviceName,
    machineId: 'dev-sibling',
    createdAt: now,
    lastSeen: now,
    tunnelUrl: null,
    terminalCount: 0,
  }));

  // Index it under the account so /api/device/list and the dashboard see it.
  const devicesRaw = await env.LICENSES.get(`devices:${parent.googleId}`);
  const devices: Array<{ token: string; deviceName: string; createdAt: string }> = devicesRaw ? JSON.parse(devicesRaw) : [];
  devices.push({ token: deviceToken, deviceName, createdAt: now });
  await env.LICENSES.put(`devices:${parent.googleId}`, JSON.stringify(devices));

  // Mirror the parent's license so the dev instance (and its remote /desktop
  // view) reflects the same plan instead of falling back to a free paywall.
  const licenseRaw = await env.LICENSES.get(`license:${parent.email}`);
  const license = licenseRaw ? JSON.parse(licenseRaw) : null;

  return new Response(JSON.stringify({
    deviceToken,
    email: parent.email,
    plan: license?.plan || 'free',
    licenseStatus: license?.status || null,
    licenseKey: license?.licenseKey || null,
  }), { status: 200, headers });
};
