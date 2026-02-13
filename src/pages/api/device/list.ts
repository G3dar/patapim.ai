import type { APIRoute } from 'astro';
import { getUserFromRequest } from '../../../lib/auth';

export const prerender = false;

const ONLINE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes (1.5x the 10-min heartbeat interval)

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const headers = { 'Content-Type': 'application/json' };

  const user = await getUserFromRequest(env.SESSIONS, context.request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const devicesRaw = await env.LICENSES.get(`devices:${user.googleId}`);
  if (!devicesRaw) {
    return new Response(JSON.stringify({ devices: [] }), { status: 200, headers });
  }

  const deviceList: Array<{ token: string; deviceName: string; createdAt: string }> = JSON.parse(devicesRaw);
  const now = Date.now();

  const devices = await Promise.all(
    deviceList.map(async (entry) => {
      const raw = await env.LICENSES.get(`device:${entry.token}`);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return {
        token: entry.token,
        deviceName: d.deviceName,
        online: now - new Date(d.lastSeen).getTime() < ONLINE_THRESHOLD_MS,
        lastSeen: d.lastSeen,
        tunnelUrl: d.tunnelUrl,
        terminalCount: d.terminalCount,
        ip: d.ip,
        city: d.city,
        country: d.country,
      };
    })
  );

  return new Response(JSON.stringify({
    devices: devices.filter(Boolean),
  }), { status: 200, headers });
};
