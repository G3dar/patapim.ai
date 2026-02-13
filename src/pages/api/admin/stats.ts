import type { APIRoute } from 'astro';
import { requireAdmin, listAllKeys, fetchAllValues } from '../../../lib/admin';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  const kv = env.LICENSES;
  const feedbackKv = env.FEEDBACK;

  // Fetch all key lists in parallel
  const [userKeys, licenseKeys, deviceKeys, referralKeys, feedbackKeys] = await Promise.all([
    listAllKeys(kv, 'user:'),
    listAllKeys(kv, 'license:'),
    listAllKeys(kv, 'device:'),
    listAllKeys(kv, 'referral:'),
    listAllKeys(feedbackKv, ''),
  ]);

  // Filter out user-email: keys (they share the user: prefix... actually they don't - user-email: != user:)
  // user: keys are user:{googleId}, user-email: keys are user-email:{email} - different prefixes

  // Fetch values in parallel
  const [users, licenses, devices, referrals] = await Promise.all([
    fetchAllValues(kv, userKeys.map(k => k.name)),
    fetchAllValues(kv, licenseKeys.map(k => k.name)),
    fetchAllValues(kv, deviceKeys.map(k => k.name)),
    fetchAllValues(kv, referralKeys.map(k => k.name)),
  ]);

  // Date calculations
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // User stats
  let newToday = 0, newThisWeek = 0, newThisMonth = 0;
  for (const [, u] of users) {
    const created = new Date(u.createdAt);
    if (u.createdAt?.slice(0, 10) === todayStr) newToday++;
    if (created >= weekAgo) newThisWeek++;
    if (created >= monthAgo) newThisMonth++;
  }

  // License breakdown
  let proCount = 0, lifetimeCount = 0;
  const statusBreakdown: Record<string, number> = {};
  for (const [, lic] of licenses) {
    if (lic.plan === 'pro') proCount++;
    else if (lic.plan === 'lifetime') lifetimeCount++;
    const status = lic.status || 'unknown';
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
  }

  // Device stats
  let onlineNow = 0;
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
  for (const [, d] of devices) {
    if (d.lastSeen && new Date(d.lastSeen) >= fifteenMinAgo) onlineNow++;
  }

  // Referral stats
  let totalInvitations = 0, totalActivations = 0, totalRewards = 0;
  for (const [, r] of referrals) {
    totalInvitations += r.referrals?.length || 0;
    totalActivations += r.activatedCount || 0;
    if (r.rewardGranted) totalRewards++;
  }

  // Download stats - fetch counter keys
  const downloadKeys = await listAllKeys(kv, 'stats:downloads:');
  const downloadValues = await fetchAllValues<string>(kv, downloadKeys.map(k => k.name));

  let totalDownloads = 0;
  let downloadsToday = 0;
  let downloadsThisWeek = 0;
  const dailyDownloads: Record<string, number> = {};
  const geoDownloads: Record<string, number> = {};

  for (const [key, val] of downloadValues) {
    const count = parseInt(String(val), 10) || 0;
    if (key === 'stats:downloads:total') {
      totalDownloads = count;
    } else if (key.startsWith('stats:downloads:geo:')) {
      geoDownloads[key.replace('stats:downloads:geo:', '')] = count;
    } else {
      const dateStr = key.replace('stats:downloads:', '');
      dailyDownloads[dateStr] = count;
      if (dateStr === todayStr) downloadsToday = count;
      const d = new Date(dateStr);
      if (d >= weekAgo) downloadsThisWeek += count;
    }
  }

  // Signup stats
  const signupKeys = await listAllKeys(kv, 'stats:signups:');
  const signupValues = await fetchAllValues<string>(kv, signupKeys.map(k => k.name));
  const dailySignups: Record<string, number> = {};
  for (const [key, val] of signupValues) {
    const dateStr = key.replace('stats:signups:', '');
    dailySignups[dateStr] = parseInt(String(val), 10) || 0;
  }

  // Build 7-day trends
  const trends: Array<{ date: string; signups: number; downloads: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const ds = d.toISOString().slice(0, 10);
    trends.push({
      date: ds,
      signups: dailySignups[ds] || 0,
      downloads: dailyDownloads[ds] || 0,
    });
  }

  // Revenue estimate
  const mrr = proCount * 6.99;
  const lifetimeRevenue = lifetimeCount * 29.99;

  return new Response(JSON.stringify({
    users: {
      total: users.size,
      newToday,
      newThisWeek,
      newThisMonth,
    },
    licenses: {
      total: licenses.size,
      pro: proCount,
      lifetime: lifetimeCount,
      statusBreakdown,
    },
    devices: {
      total: devices.size,
      onlineNow,
      avgPerUser: users.size > 0 ? +(devices.size / users.size).toFixed(1) : 0,
    },
    referrals: {
      totalReferrers: referrals.size,
      totalInvitations,
      totalActivations,
      conversionRate: totalInvitations > 0 ? +((totalActivations / totalInvitations) * 100).toFixed(1) : 0,
      totalRewards,
    },
    downloads: {
      total: totalDownloads,
      today: downloadsToday,
      thisWeek: downloadsThisWeek,
      geo: geoDownloads,
    },
    feedback: {
      total: feedbackKeys.length,
    },
    revenue: {
      mrr: +mrr.toFixed(2),
      lifetimeRevenue: +lifetimeRevenue.toFixed(2),
    },
    trends,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
