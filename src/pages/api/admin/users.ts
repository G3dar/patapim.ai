import type { APIRoute } from 'astro';
import { requireAdmin, listAllKeys, fetchAllValues } from '../../../lib/admin';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  const kv = env.LICENSES;
  const url = new URL(context.request.url);
  const search = (url.searchParams.get('search') || '').toLowerCase();
  const planFilter = url.searchParams.get('plan') || 'all';
  const cursorParam = url.searchParams.get('cursor') || '';
  const limit = 50;

  // List all user keys
  const userKeys = await listAllKeys(kv, 'user:');
  const userValues = await fetchAllValues(kv, userKeys.map(k => k.name));

  // Build user list with license info
  type UserEntry = {
    googleId: string;
    email: string;
    name: string;
    picture: string;
    plan: string;
    licenseStatus: string | null;
    licenseKey: string | null;
    deviceCount: number;
    createdAt: string;
    lastLogin: string;
  };

  const allUsers: UserEntry[] = [];

  // Batch-fetch licenses and device lists
  const emails: string[] = [];
  const googleIds: string[] = [];
  for (const [, u] of userValues) {
    if (u.email) emails.push(u.email);
    if (u.googleId) googleIds.push(u.googleId);
  }

  const [licenseMap, devicesMap] = await Promise.all([
    fetchAllValues(kv, emails.map(e => `license:${e}`)),
    fetchAllValues(kv, googleIds.map(id => `devices:${id}`)),
  ]);

  for (const [, u] of userValues) {
    const license = licenseMap.get(`license:${u.email}`);
    const devices = devicesMap.get(`devices:${u.googleId}`);
    const plan = license?.plan || u.plan || 'free';

    allUsers.push({
      googleId: u.googleId,
      email: u.email,
      name: u.name || '',
      picture: u.picture || '',
      plan,
      licenseStatus: license?.status || null,
      licenseKey: license?.licenseKey || null,
      deviceCount: Array.isArray(devices) ? devices.length : 0,
      createdAt: u.createdAt || '',
      lastLogin: u.lastLogin || '',
    });
  }

  // Sort by createdAt descending
  allUsers.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  // Apply filters
  let filtered = allUsers;
  if (search) {
    filtered = filtered.filter(u =>
      u.email.toLowerCase().includes(search) ||
      u.name.toLowerCase().includes(search)
    );
  }
  if (planFilter !== 'all') {
    filtered = filtered.filter(u => u.plan === planFilter);
  }

  // Cursor-based pagination (cursor = index)
  const startIdx = cursorParam ? parseInt(cursorParam, 10) : 0;
  const page = filtered.slice(startIdx, startIdx + limit);
  const nextCursor = startIdx + limit < filtered.length ? String(startIdx + limit) : null;

  return new Response(JSON.stringify({
    users: page,
    total: filtered.length,
    nextCursor,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
