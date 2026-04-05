import type { APIRoute } from 'astro';
import { requireAdmin, listAllKeys, fetchAllValues } from '../../../lib/admin';

export const prerender = false;

const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  const kv = env.LICENSES;

  // Fetch all devices and users
  const [deviceKeys, userKeys] = await Promise.all([
    listAllKeys(kv, 'device:'),
    listAllKeys(kv, 'user:'),
  ]);

  const [devices, users] = await Promise.all([
    fetchAllValues(kv, deviceKeys.map(k => k.name)),
    fetchAllValues(kv, userKeys.map(k => k.name)),
  ]);

  // Build googleId -> user lookup
  const userByGoogleId = new Map<string, any>();
  for (const [, u] of users) {
    if (u.googleId) userByGoogleId.set(u.googleId, u);
  }

  // Build device entries with owner info
  const now = Date.now();
  type DeviceEntry = {
    deviceName: string;
    lastSeen: string;
    online: boolean;
    city: string;
    country: string;
    platform: string;
    ownerName: string;
    ownerEmail: string;
    ownerPicture: string;
    ownerGoogleId: string;
  };

  const allDevices: DeviceEntry[] = [];
  for (const [key, d] of devices) {
    if (!d.lastSeen) continue;
    const owner = d.googleId ? userByGoogleId.get(d.googleId) : null;
    allDevices.push({
      deviceName: d.deviceName || 'Unknown',
      lastSeen: d.lastSeen,
      online: (now - new Date(d.lastSeen).getTime()) < ONLINE_THRESHOLD_MS,
      city: d.city || '',
      country: d.country || '',
      platform: d.platform || '',
      ownerName: owner?.name || '',
      ownerEmail: owner?.email || d.email || '',
      ownerPicture: owner?.picture || '',
      ownerGoogleId: d.googleId || '',
    });
  }

  // Sort by lastSeen descending
  allDevices.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

  // Split into online and recent (last 30 unique users who aren't currently online)
  const onlineDevices = allDevices.filter(d => d.online);

  // For recent: deduplicate by user (googleId or email), exclude online users
  const onlineUserIds = new Set(onlineDevices.map(d => d.ownerGoogleId || d.ownerEmail));
  const seenRecent = new Set<string>();
  const recentUsers: DeviceEntry[] = [];
  for (const d of allDevices) {
    if (d.online) continue;
    const uid = d.ownerGoogleId || d.ownerEmail;
    if (!uid || onlineUserIds.has(uid) || seenRecent.has(uid)) continue;
    seenRecent.add(uid);
    recentUsers.push(d);
    if (recentUsers.length >= 30) break;
  }

  return new Response(JSON.stringify({
    online: onlineDevices,
    recent: recentUsers,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
