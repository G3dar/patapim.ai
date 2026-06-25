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

  let body: { tunnelUrl?: string; terminalCount?: number; terminalCounts?: { attention: number; busy: number; planMode: number; idle: number }; deviceName?: string; platform?: string; appVersion?: string; lastPrompt?: string; syncthingDeviceId?: string; remoteUI?: string } = {};
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
