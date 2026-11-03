import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

// SECURITY (N-7): tunnelUrl is fetched server-side later (device/list and
// device/debug do `fetch(tunnelUrl + '/ping')`). Restrict it to https on the
// known tunnel domains so a device can't point it at internal/arbitrary hosts
// (SSRF oracle). The app only ever produces https://<sub>.trycloudflare.com.
function isAllowedTunnelUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false;
  let u: URL;
  try { u = new URL(value); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  return h === 'trycloudflare.com' || h.endsWith('.trycloudflare.com')
    || h === 'patapim.ai' || h.endsWith('.patapim.ai');
}

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  // Bearer token auth
  const auth = context.request.headers.get('Authorization');
  const deviceToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!deviceToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const raw = await env.LICENSES.get(`device:${deviceToken}`);
  if (!raw) {
    return new Response(JSON.stringify({ error: 'Device not found' }), { status: 404, headers });
  }

  let body: { tunnelUrl?: string; terminalCount?: number; terminalCounts?: { attention: number; busy: number; planMode: number; idle: number }; deviceName?: string; platform?: string; appVersion?: string; lastPrompt?: string; syncthingDeviceId?: string; syncthingAddresses?: string[]; remoteUI?: string; macs?: string[]; instanceId?: string } = {};
  try {
    body = await context.request.json();
  } catch {}

  const device = JSON.parse(raw);

  // Extract IP and geolocation from Cloudflare headers
  const ip = context.request.headers.get('CF-Connecting-IP') || undefined;
  const cf = (context.request as any).cf;
  const city = cf?.city || undefined;
  const country = cf?.country || undefined;

  // Check if device name changed.
  // Don't let a default-fallback name ("PATAPIM Desktop") overwrite a custom name set via dashboard rename.
  const incomingName = body.deviceName;
  const currentName = device.deviceName;
  const nameChanged = incomingName &&
    incomingName !== currentName &&
    !(incomingName === 'PATAPIM Desktop' && currentName && currentName !== 'PATAPIM Desktop');

  // Always update lastSeen so stable (unchanged) devices don't fall offline
  device.lastSeen = new Date().toISOString();
  if (body.tunnelUrl !== undefined) device.tunnelUrl = isAllowedTunnelUrl(body.tunnelUrl) ? body.tunnelUrl : null;
  if (body.terminalCount !== undefined) device.terminalCount = body.terminalCount;
  if (body.terminalCounts !== undefined) device.terminalCounts = body.terminalCounts;
  if (ip !== undefined) device.ip = ip;
  if (city !== undefined) device.city = city;
  if (country !== undefined) device.country = country;
  if (nameChanged) device.deviceName = incomingName;
  if (body.platform) device.platform = body.platform;
  // App version from electron app.getVersion() — cap length so a hostile
  // client can't bloat the KV record.
  if (typeof body.appVersion === 'string' && body.appVersion.length <= 32) device.appVersion = body.appVersion;
  if (body.lastPrompt) device.lastPrompt = body.lastPrompt;
  // Per-machine mobile UI preference: which UI a phone gets when remoting into
  // this device. 'simple' = plain mobile HTML (/remote-mobile); anything else
  // = the rich app-copy (/remotedesk). /remote reads this to route the phone.
  if (body.remoteUI !== undefined) device.remoteUI = body.remoteUI === 'simple' ? 'simple' : 'desktop';
  // Syncthing device ID for folder-sync mesh formation. A 56-char base32 ID in
  // 7 dash-separated groups; validate loosely so a malformed value can't poison
  // peers' Syncthing configs. Empty string clears it (device stopped syncing).
  if (body.syncthingDeviceId !== undefined) {
    const v = body.syncthingDeviceId;
    if (v === '') device.syncthingDeviceId = null;
    else if (typeof v === 'string' && /^[A-Z2-7-]{50,70}$/.test(v)) device.syncthingDeviceId = v;
  }
  // Direct Syncthing addresses on this machine's networks (tcp:// / quic://
  // IPv4:port). Peers on the same LAN dial these first instead of relying on
  // broadcast discovery or a relay. Strict format + cap: they end up in other
  // machines' Syncthing configs.
  if (Array.isArray(body.syncthingAddresses)) {
    device.syncthingAddresses = body.syncthingAddresses
      .filter((a: unknown) => typeof a === 'string' && /^(tcp|quic):\/\/\d{1,3}(\.\d{1,3}){3}:\d{2,5}$/.test(a))
      .slice(0, 12);
  }
  // Physical NIC MAC addresses, published so an always-on LAN agent (a Flic Hub,
  // or another awake PATAPIM on the same network) can send a Wake-on-LAN magic
  // packet to this machine when it's asleep. Validate strictly and cap the count
  // so a hostile client can't bloat the record or poison it with junk.
  if (Array.isArray(body.macs)) {
    const macRe = /^[0-9a-f]{2}([:-][0-9a-f]{2}){5}$/i;
    device.macs = body.macs
      .filter((m): m is string => typeof m === 'string' && macRe.test(m))
      .map((m) => m.toUpperCase().replace(/-/g, ':'))
      .filter((m, i, a) => a.indexOf(m) === i)
      .slice(0, 8);
  }
  // Stable per-install identity (the app's remote.instanceId, minted once and
  // kept in ~/.patapim/settings.json). A device token is minted per pairing,
  // so a re-pair (sign-in again, revoked token, 14 days offline) gives the
  // SAME machine a new token — and every phone pin / history keyed by the old
  // token stops working. The first heartbeat that carries an instanceId this
  // record did not have looks for the account's older records of the same
  // install: a dead predecessor (no heartbeat for 20 min) is absorbed — its
  // token goes into `aliases` so clients (the mobile app) can re-key what they
  // stored, and its record is removed from the list. Dev-sibling devices
  // share the install's id with their stable instance and are never merged.
  let absorbed: string[] = [];
  const incomingInstanceId = typeof body.instanceId === 'string' && /^[A-Za-z0-9:_-]{8,64}$/.test(body.instanceId) ? body.instanceId : null;
  if (incomingInstanceId && device.instanceId !== incomingInstanceId) {
    device.instanceId = incomingInstanceId;
    if (device.machineId !== 'dev-sibling' && device.googleId) {
      const devicesRaw = await env.LICENSES.get(`devices:${device.googleId}`);
      const list: Array<{ token: string; deviceName: string; createdAt: string }> = devicesRaw ? JSON.parse(devicesRaw) : [];
      const DEAD_MS = 20 * 60 * 1000;
      for (const entry of list) {
        if (entry.token === deviceToken) continue;
        const otherRaw = await env.LICENSES.get(`device:${entry.token}`);
        if (!otherRaw) continue;
        let other: any; try { other = JSON.parse(otherRaw); } catch { continue; }
        if (other.instanceId !== incomingInstanceId || other.machineId === 'dev-sibling') continue;
        if (Date.now() - new Date(other.lastSeen || 0).getTime() < DEAD_MS) continue; // still alive: not ours to take
        absorbed.push(entry.token, ...(Array.isArray(other.aliases) ? other.aliases : []));
        // A name the user set on the dashboard outlives the re-pair.
        if ((!device.deviceName || device.deviceName === 'PATAPIM Desktop') && other.deviceName) device.deviceName = other.deviceName;
        await env.LICENSES.delete(`device:${entry.token}`).catch(() => {});
      }
      if (absorbed.length) {
        device.aliases = Array.from(new Set([...(Array.isArray(device.aliases) ? device.aliases : []), ...absorbed])).slice(0, 20);
        const kept = list.filter((d) => !absorbed.includes(d.token));
        await env.LICENSES.put(`devices:${device.googleId}`, JSON.stringify(kept));
      }
    }
  }
  await env.LICENSES.put(`device:${deviceToken}`, JSON.stringify(device));

  // Also update the device name in the user's device list (same pattern as rename.ts)
  if (nameChanged && device.googleId) {
    const devicesRaw = await env.LICENSES.get(`devices:${device.googleId}`);
    if (devicesRaw) {
      const devices = JSON.parse(devicesRaw);
      const entry = devices.find((d: any) => d.token === deviceToken);
      if (entry) {
        entry.deviceName = incomingName;
        await env.LICENSES.put(`devices:${device.googleId}`, JSON.stringify(devices));
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
