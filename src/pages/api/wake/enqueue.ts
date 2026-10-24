import type { APIRoute } from 'astro';
import { getUserFromRequestOrDeviceToken } from '../../../lib/auth';

export const prerender = false;

/**
 * Queue a Wake-on-LAN request for one of the account's own machines.
 *
 * Called from the remote UI (session cookie) when the user taps "Wake" on an
 * offline device. We look up that device's stored MAC(s) and push a job onto
 * a short-lived per-account queue; the account's wake agent (Flic Hub / awake
 * PATAPIM) drains it via /api/wake/poll and broadcasts the magic packet.
 *
 * The server never sends UDP itself — Cloudflare Workers can't, and the target
 * is asleep behind NAT anyway. The LAN agent is what actually wakes it.
 */
export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const headers = { 'Content-Type': 'application/json' };

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

  const raw = await env.LICENSES.get(`device:${deviceToken}`);
  if (!raw) {
    return new Response(JSON.stringify({ error: 'Device not found' }), { status: 404, headers });
  }

  let device: { googleId?: string; deviceName?: string; macs?: string[] };
  try {
    device = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: 'Device data corrupted' }), { status: 500, headers });
  }
  if (device.googleId !== user.googleId) {
    return new Response(JSON.stringify({ error: 'Device does not belong to this user' }), { status: 403, headers });
  }

  const macs = Array.isArray(device.macs) ? device.macs : [];
  if (!macs.length) {
    return new Response(
      JSON.stringify({ error: 'No MAC on record for this device. Open PATAPIM on it once (while online) to publish it.' }),
      { status: 400, headers },
    );
  }

  // Whether anything is actually listening to fire the packet.
  const hasAgent = !!(await env.LICENSES.get(`wake-agent-account:${user.googleId}`));

  const key = `wake-queue:${user.googleId}`;
  const nowMs = Date.now();
  let queue: Array<{ deviceToken: string; deviceName: string | null; macs: string[]; at: number }> = [];
  try {
    const q = await env.LICENSES.get(key);
    if (q) queue = JSON.parse(q);
  } catch {}
  // Drop the previous entry for this device and any stale jobs (> 3 min).
  queue = queue.filter((j) => j && j.deviceToken !== deviceToken && nowMs - (j.at || 0) < 180000);
  queue.push({ deviceToken, deviceName: device.deviceName || null, macs, at: nowMs });
  await env.LICENSES.put(key, JSON.stringify(queue), { expirationTtl: 300 });

  return new Response(JSON.stringify({ ok: true, queued: macs.length, hasAgent }), { status: 200, headers });
};
