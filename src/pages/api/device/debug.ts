import type { APIRoute } from 'astro';
import { getUserFromRequest } from '../../../lib/auth';

export const prerender = false;

const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const headers = { 'Content-Type': 'application/json' };

  const user = await getUserFromRequest(env.SESSIONS, context.request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const devicesRaw = await env.LICENSES.get(`devices:${user.googleId}`);
  if (!devicesRaw) {
    return new Response(JSON.stringify({ devices: [], pairedCount: 0 }), { status: 200, headers });
  }

  const deviceList: Array<{ token: string; deviceName: string; createdAt: string }> = JSON.parse(devicesRaw);
  const now = Date.now();

  const devices = await Promise.all(
    deviceList.map(async (entry) => {
      const raw = await env.LICENSES.get(`device:${entry.token}`);
      if (!raw) {
        return { token: entry.token, deviceName: entry.deviceName, error: 'device record missing from KV' };
      }
      const d = JSON.parse(raw);
      const heartbeatAge = now - new Date(d.lastSeen).getTime();
      const heartbeatOnline = heartbeatAge < ONLINE_THRESHOLD_MS;

      // Ping tunnel
      let pingResult: { ok: boolean; error?: string; latencyMs?: number } = { ok: false };
      if (d.tunnelUrl) {
        const start = Date.now();
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 4000);
          const pingRes = await fetch(d.tunnelUrl + '/ping', { signal: ctrl.signal });
          clearTimeout(timer);
          const pingData = await pingRes.json() as { ok?: boolean };
          pingResult = { ok: !!pingData.ok, latencyMs: Date.now() - start };
        } catch (e: any) {
          pingResult = { ok: false, error: e?.message || 'fetch failed', latencyMs: Date.now() - start };
        }
      } else {
        pingResult = { ok: false, error: 'no tunnelUrl' };
      }

      return {
        token: entry.token,
        deviceName: d.deviceName,
        createdAt: entry.createdAt,
        lastSeen: d.lastSeen,
        heartbeatAgeMs: heartbeatAge,
        heartbeatOnline,
        tunnelUrl: d.tunnelUrl || null,
        ping: pingResult,
        terminalCount: d.terminalCount || 0,
        ip: d.ip,
        city: d.city,
        country: d.country,
      };
    })
  );

  return new Response(JSON.stringify({ pairedCount: deviceList.length, devices }, null, 2), { status: 200, headers });
};
