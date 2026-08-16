import type { APIRoute } from 'astro';
import { getUserFromRequestOrDeviceToken } from '../../../lib/auth';
import { mintV2ConnectToken, appVersionAtLeast, MIN_V2_APP_VERSION } from '../../../lib/connectToken';

export const prerender = false;

const ONLINE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes (1.5x the 10-min heartbeat interval)
const HIDE_OFFLINE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days — hide from list
const STALE_DELETE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days — auto-delete from KV

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const t0 = Date.now();
  // ?lite=1 — routing/first-paint mode: skip the per-device live tunnel pings
  // (each up to 4s, Promise.all → the slowest device gates the response) and
  // answer from KV alone in ~100-250ms. Consumers treat status 'heartbeat' as
  // "probably up, unverified" and must handle a connect that then fails.
  const params = new URL(context.request.url).searchParams;
  const lite = params.get('lite') === '1';
  // &connect=1 — when exactly one device is connectable AND its app verifies
  // v2 tokens locally, mint the connect token inline (stateless, free) so the
  // client skips the separate POST /connect-token round trip entirely.
  const wantConnect = params.get('connect') === '1';

  const user = await getUserFromRequestOrDeviceToken(env.SESSIONS, env.LICENSES, context.request);
  const tAuth = Date.now();
  const timing = () => ({
    'Content-Type': 'application/json',
    'Server-Timing': `auth;dur=${tAuth - t0}, total;dur=${Date.now() - t0}${lite ? ', lite' : ''}`,
  });
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: timing() });
  }

  // Parallel: the devices blob and the wake-agent flag are independent reads.
  const [devicesRaw, wakeAgentRaw] = await Promise.all([
    env.LICENSES.get(`devices:${user.googleId}`),
    env.LICENSES.get(`wake-agent-account:${user.googleId}`),
  ]);
  if (!devicesRaw) {
    return new Response(JSON.stringify({ devices: [] }), { status: 200, headers: timing() });
  }

  const deviceList: Array<{ token: string; deviceName: string; createdAt: string }> = JSON.parse(devicesRaw);
  const now = Date.now();
  const stalledTokens = new Set<string>();
  const deferredKv: Promise<unknown>[] = [];

  // Whether this account has an always-on Wake-on-LAN agent registered (a Flic
  // Hub or another PATAPIM polling /api/wake/poll). Only then is an offline
  // device actually wakeable — otherwise the Wake button would be a dead end.
  const hasWakeAgent = !!wakeAgentRaw;

  const devices = await Promise.all(
    deviceList.map(async (entry) => {
      const raw = await env.LICENSES.get(`device:${entry.token}`);
      if (!raw) return null;
      const d = JSON.parse(raw);
      const heartbeatAge = now - new Date(d.lastSeen).getTime();
      const heartbeatOnline = heartbeatAge < ONLINE_THRESHOLD_MS;

      // Auto-delete devices offline for more than 7 days (off the critical path)
      if (heartbeatAge > STALE_DELETE_MS) {
        deferredKv.push(env.LICENSES.delete(`device:${entry.token}`).catch(() => {}));
        stalledTokens.add(entry.token);
        return null;
      }

      // Server-side ping to tunnel URL for real-time status (skipped in lite mode)
      let online = false;
      let terminalCount = d.terminalCount;
      let terminalCounts = d.terminalCounts || null;
      if (!lite && d.tunnelUrl && heartbeatOnline) {
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
      // Lite mode reintroduces 'heartbeat' DELIBERATELY: it's the "probably up"
      // answer that lets routing/UI paint instantly; connect paths that use it
      // must fall back gracefully when the tunnel turns out to be dead.
      const status = online ? 'online' : (lite && heartbeatOnline ? 'heartbeat' : 'offline');

      return {
        token: entry.token,
        deviceName: d.deviceName,
        machineId: d.machineId || null,
        online,
        status,
        lastSeen: d.lastSeen,
        // Lite mode advertises the tunnelUrl on heartbeat-fresh devices too —
        // consumers know 'heartbeat' means unverified and must tolerate a
        // failed connect (the full mode only advertises ping-verified ones).
        tunnelUrl: (online || status === 'heartbeat') ? d.tunnelUrl : null,
        terminalCount,
        terminalCounts,
        ip: d.ip,
        city: d.city,
        country: d.country,
        platform: d.platform || null,
        appVersion: d.appVersion || null,
        lastPrompt: d.lastPrompt || null,
        syncthingDeviceId: d.syncthingDeviceId || null,
        // Wake-on-LAN: the machine's physical NIC MACs, and whether it can be
        // woken right now (offline, we know a MAC, and a wake agent is online to
        // send the magic packet on its LAN).
        macs: Array.isArray(d.macs) ? d.macs : [],
        wakeable: !online && Array.isArray(d.macs) && d.macs.length > 0 && hasWakeAgent,
        // Per-machine mobile UI preference: 'simple' → /remote-mobile,
        // else (default) → /remotedesk. /remote routes the phone by this.
        remoteUI: d.remoteUI === 'simple' ? 'simple' : 'desktop',
      };
    })
  );

  // Remove stale tokens from the user's device list (off the critical path)
  if (stalledTokens.size > 0) {
    const updated = deviceList.filter(e => !stalledTokens.has(e.token));
    deferredKv.push(env.LICENSES.put(`devices:${user.googleId}`, JSON.stringify(updated)).catch(() => {}));
  }
  if (deferredKv.length > 0) {
    const ctx = (context.locals as any).runtime?.ctx;
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(Promise.all(deferredKv));
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

  const finalDevices = Array.from(byName.values());

  let connect: { deviceToken: string; connectToken: string; tunnelUrl: string } | null = null;
  if (wantConnect) {
    const bearer = (context.request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const candidates = finalDevices.filter(x =>
      (x.online || x.status === 'heartbeat') && x.tunnelUrl
      && x.token !== bearer // same self-targeting guard as connect-token.ts
      && appVersionAtLeast(x.appVersion, MIN_V2_APP_VERSION));
    if (candidates.length === 1) {
      connect = {
        deviceToken: candidates[0].token,
        connectToken: await mintV2ConnectToken(candidates[0].token, user, 300),
        tunnelUrl: candidates[0].tunnelUrl as string,
      };
    }
  }

  return new Response(JSON.stringify({
    devices: finalDevices,
    ...(connect ? { connect } : {}),
  }), { status: 200, headers: timing() });
};
