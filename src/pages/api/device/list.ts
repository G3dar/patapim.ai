import type { APIRoute } from 'astro';
import { getUserFromRequestOrDeviceToken } from '../../../lib/auth';

export const prerender = false;

const ONLINE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes (1.5x the 10-min heartbeat interval)
const HIDE_OFFLINE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days — hide from list
const STALE_DELETE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days — auto-delete from KV

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const headers = { 'Content-Type': 'application/json' };

  const user = await getUserFromRequestOrDeviceToken(env.SESSIONS, env.LICENSES, context.request);
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
      let terminalCounts = d.terminalCounts || null;
      if (d.tunnelUrl && heartbeatOnline) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 4000);
          const pingRes = await fetch(d.tunnelUrl + '/ping', { signal: ctrl.signal });
          clearTimeout(timer);
          const pingData = await pingRes.json() as { ok?: boolean; terminalCount?: number; terminalCounts?: { attention: number; busy: number; planMode: number; idle: number } };
          if (pingData.ok) {
            online = true;
            if (pingData.terminalCount) terminalCount = pingData.terminalCount;
            if (pingData.terminalCounts) terminalCounts = pingData.terminalCounts;
          }
        } catch {
          // Tunnel unreachable — device may still be running
        }
      }

      // Reachability is decided by the live tunnel ping (`online`), NOT by
      // heartbeat recency. Heartbeats are only every ~10 min, so a recent
      // heartbeat does NOT mean the device is reachable — when the live ping
      // fails, the tunnel is down (1033/530) and the device is effectively
      // offline. We previously reported that in-between case as 'heartbeat',
      // which clients painted yellow and still offered to connect to (the
      // connection then failed). Collapse it to 'offline' and stop advertising a
      // dead tunnelUrl so no client treats it as connectable.
      const status = online ? 'online' : 'offline';

      return {
        token: entry.token,
        deviceName: d.deviceName,
        machineId: d.machineId || null,
        online,
        status,
        lastSeen: d.lastSeen,
        tunnelUrl: online ? d.tunnelUrl : null,
        terminalCount,
        terminalCounts,
        ip: d.ip,
        city: d.city,
        country: d.country,
        platform: d.platform || null,
        appVersion: d.appVersion || null,
        lastPrompt: d.lastPrompt || null,
        syncthingDeviceId: d.syncthingDeviceId || null,
      };
    })
  );

  // Remove stale tokens from the user's device list
  if (stalledTokens.size > 0) {
    const updated = deviceList.filter(e => !stalledTokens.has(e.token));
    await env.LICENSES.put(`devices:${user.googleId}`, JSON.stringify(updated));
  }

  // Collapse multiple registrations of the SAME machine. Re-pairing (or a
  // re-install / sign-out-in) mints a brand-new device token each time — and
  // historically a fresh random machineId too — so one physical machine can
  // appear several times, e.g. "CASA" online plus two stale "CASA" entries from
  // days ago. We group by (normalized) deviceName because the whole connect
  // path already treats the name as a unique handle (resolveDeviceByName picks
  // the first name match), so the token/machineId churn behind a name is not
  // separately addressable anyway. Survivor per name: the online one wins, else
  // the most recently seen.
  const live = devices.filter(Boolean) as NonNullable<typeof devices[number]>[];
  const seenMs = (d: { lastSeen?: string }) => {
    const t = d.lastSeen ? new Date(d.lastSeen).getTime() : 0;
    return isFinite(t) ? t : 0;
  };
  const isBetter = (a: typeof live[number], b: typeof live[number]) =>
    a.online !== b.online ? a.online : seenMs(a) > seenMs(b);
  const byName = new Map<string, typeof live[number]>();
  for (const d of live) {
    const key = (d.deviceName || '').trim().toLowerCase() || `token:${d.token}`;
    const prev = byName.get(key);
    if (!prev || isBetter(d, prev)) byName.set(key, d);
  }

  return new Response(JSON.stringify({
    devices: Array.from(byName.values()),
  }), { status: 200, headers });
};
