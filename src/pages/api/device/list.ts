import type { APIRoute } from 'astro';
import { getUserFromRequest } from '../../../lib/auth';

export const prerender = false;

const ONLINE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes (1.5x the 10-min heartbeat interval)
const STALE_DELETE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
  const stalledTokens = new Set<string>();

  const devices = await Promise.all(
    deviceList.map(async (entry) => {
      const raw = await env.LICENSES.get(`device:${entry.token}`);
      if (!raw) return null;
      const d = JSON.parse(raw);
      const heartbeatAge = now - new Date(d.lastSeen).getTime();
      const heartbeatOnline = heartbeatAge < ONLINE_THRESHOLD_MS;

      // Auto-delete devices offline for more than 7 days
      if (heartbeatAge > STALE_DELETE_MS) {
        await env.LICENSES.delete(`device:${entry.token}`);
        stalledTokens.add(entry.token);
        return null;
      }

      // Server-side ping to tunnel URL for real-time status
      let online = false;
      let terminalCount = d.terminalCount;
      if (d.tunnelUrl && heartbeatOnline) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 4000);
          const pingRes = await fetch(d.tunnelUrl + '/ping', { signal: ctrl.signal });
          clearTimeout(timer);
          const pingData = await pingRes.json() as { ok?: boolean; terminalCount?: number };
          if (pingData.ok) {
            online = true;
            if (pingData.terminalCount) terminalCount = pingData.terminalCount;
          }
        } catch {
          // Tunnel unreachable — device may still be running
        }
      }

      // Determine status: online (ping OK), heartbeat (recent but ping failed), offline (stale)
      const status = online ? 'online' : heartbeatOnline ? 'heartbeat' : 'offline';

      return {
        token: entry.token,
        deviceName: d.deviceName,
        online,
        status,
        lastSeen: d.lastSeen,
        tunnelUrl: d.tunnelUrl,
        terminalCount,
        ip: d.ip,
        city: d.city,
        country: d.country,
      };
    })
  );

  // Remove stale tokens from the user's device list
  if (stalledTokens.size > 0) {
    const updated = deviceList.filter(e => !stalledTokens.has(e.token));
    await env.LICENSES.put(`devices:${user.googleId}`, JSON.stringify(updated));
  }

  return new Response(JSON.stringify({
    devices: devices.filter(Boolean),
  }), { status: 200, headers });
};
