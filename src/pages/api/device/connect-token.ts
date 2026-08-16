import type { APIRoute } from 'astro';
import { getUserFromRequestOrDeviceToken } from '../../../lib/auth';
import { mintV2ConnectToken, appVersionAtLeast, MIN_V2_APP_VERSION } from '../../../lib/connectToken';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const t0 = Date.now();
  const headers = { 'Content-Type': 'application/json' };

  // Auth via session cookie (web) or bearer device token (desktop)
  const user = await getUserFromRequestOrDeviceToken(env.SESSIONS, env.LICENSES, context.request);
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

  // Prevent self-targeting — a device cannot create a connect token for itself
  const bearerToken = context.request.headers.get('authorization');
  if (bearerToken && deviceToken === bearerToken.replace(/^Bearer\s+/i, '').trim()) {
    return new Response(JSON.stringify({ error: 'Cannot target own device' }), { status: 400, headers });
  }

  // Verify device exists and belongs to this user
  const raw = await env.LICENSES.get(`device:${deviceToken}`);
  if (!raw) {
    return new Response(JSON.stringify({ error: 'Device not found' }), { status: 404, headers });
  }

  let device: Record<string, unknown>;
  try {
    device = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: 'Device data corrupted' }), { status: 500, headers });
  }
  if (device.googleId !== user.googleId) {
    return new Response(JSON.stringify({ error: 'Device does not belong to this user' }), { status: 403, headers });
  }

  // Check device is online and has a tunnel URL
  if (!device.tunnelUrl) {
    return new Response(JSON.stringify({ error: 'Device is not online or tunnel not available' }), { status: 400, headers });
  }

  // v2 self-verifying token when the target device's app can verify it
  // locally (no KV write here, no KV read + consistency stall on the device —
  // the whole verify-connect round trip disappears from auth). Older apps get
  // the legacy KV-backed UUID. Kill-switch: bump MIN_V2_APP_VERSION sky-high.
  let connectToken: string;
  if (appVersionAtLeast(device.appVersion, MIN_V2_APP_VERSION)) {
    connectToken = await mintV2ConnectToken(deviceToken, user, 300);
  } else {
    connectToken = crypto.randomUUID();
    // Store in KV with 5-minute TTL
    await env.SESSIONS.put(`connect:${connectToken}`, JSON.stringify({
      googleId: user.googleId,
      email: user.email,
      deviceToken,
      createdAt: new Date().toISOString(),
    }), { expirationTtl: 300 });
  }

  return new Response(JSON.stringify({
    connectToken,
    tunnelUrl: device.tunnelUrl,
    expiresIn: 300,
  }), {
    status: 200,
    headers: { ...headers, 'Server-Timing': `total;dur=${Date.now() - t0};desc="${connectToken.startsWith('v2.') ? 'v2' : 'legacy'}"` },
  });
};
