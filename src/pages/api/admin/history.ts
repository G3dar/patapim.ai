import type { APIRoute } from 'astro';
import { requireAdmin, listAllKeys, fetchAllValues } from '../../../lib/admin';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  const kv = env.LICENSES;
  const url = new URL(context.request.url);

  // Parse month param: "2026-03" format, defaults to current month
  const now = new Date();
  const monthParam = url.searchParams.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [yearStr, monStr] = monthParam.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monStr, 10); // 1-based

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return new Response(JSON.stringify({ error: 'Invalid month parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build list of dates in this month
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  // Don't include future dates
  const todayStr = now.toISOString().slice(0, 10);
  const validDates = dates.filter(d => d <= todayStr);

  // Fetch daily downloads, signups, pageviews, referrers, mac downloads, and DAU in parallel
  const [downloadValues, signupValues, pageviewValues, referrerValues, macValues, dauValues] = await Promise.all([
    fetchAllValues<string>(kv, validDates.map(d => `stats:downloads:${d}`)),
    fetchAllValues<string>(kv, validDates.map(d => `stats:signups:${d}`)),
    fetchAllValues<string>(kv, validDates.map(d => `stats:pageviews:${d}`)),
    fetchAllValues<Record<string, number>>(kv, validDates.map(d => `stats:referrers:${d}`)),
    fetchAllValues<string>(kv, validDates.map(d => `stats:downloads:mac:${d}`)),
    fetchAllValues<Record<string, boolean>>(kv, validDates.map(d => `stats:dau:${d}`)),
  ]);

  // Fetch all licenses to compute daily new subscriptions
  const licenseKeys = await listAllKeys(kv, 'license:');
  const licenseValues = await fetchAllValues(kv, licenseKeys.map(k => k.name));

  // Count new subscriptions per day (pro and lifetime separately)
  const dailyNewPro: Record<string, number> = {};
  const dailyNewLifetime: Record<string, number> = {};
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  for (const [, lic] of licenseValues) {
    if (!lic.createdAt) continue;
    const dateStr = lic.createdAt.slice(0, 10);
    if (!dateStr.startsWith(monthPrefix)) continue;

    if (lic.plan === 'pro') {
      dailyNewPro[dateStr] = (dailyNewPro[dateStr] || 0) + 1;
    } else if (lic.plan === 'lifetime') {
      dailyNewLifetime[dateStr] = (dailyNewLifetime[dateStr] || 0) + 1;
    }
  }

  // Build daily data
  const days = validDates.map(date => {
    const downloads = parseInt(String(downloadValues.get(`stats:downloads:${date}`) || '0'), 10) || 0;
    const mac = parseInt(String(macValues.get(`stats:downloads:mac:${date}`) || '0'), 10) || 0;
    const dauObj = dauValues.get(`stats:dau:${date}`);
    const dau = dauObj && typeof dauObj === 'object' ? Object.keys(dauObj).length : 0;
    return {
      date,
      pageviews: parseInt(String(pageviewValues.get(`stats:pageviews:${date}`) || '0'), 10) || 0,
      downloads,
      mac,
      win: Math.max(0, downloads - mac),
      signups: parseInt(String(signupValues.get(`stats:signups:${date}`) || '0'), 10) || 0,
      newPro: dailyNewPro[date] || 0,
      newLifetime: dailyNewLifetime[date] || 0,
      dau,
    };
  });

  // Compute totals for the month
  // Compute unique DAU for the month (union of all daily sets)
  const monthDauEmails = new Set<string>();
  for (const date of validDates) {
    const dauObj = dauValues.get(`stats:dau:${date}`);
    if (dauObj && typeof dauObj === 'object') {
      for (const email of Object.keys(dauObj)) monthDauEmails.add(email);
    }
  }

  const totals = days.reduce((acc, d) => ({
    pageviews: acc.pageviews + d.pageviews,
    downloads: acc.downloads + d.downloads,
    mac: acc.mac + d.mac,
    win: acc.win + d.win,
    signups: acc.signups + d.signups,
    newPro: acc.newPro + d.newPro,
    newLifetime: acc.newLifetime + d.newLifetime,
    dau: Math.max(acc.dau, d.dau),
  }), { pageviews: 0, downloads: 0, mac: 0, win: 0, signups: 0, newPro: 0, newLifetime: 0, dau: 0 });
  totals.dau = monthDauEmails.size; // monthly unique users, not sum

  // Aggregate referrers across the month
  const referrers: Record<string, number> = {};
  for (const date of validDates) {
    const dayRefs = referrerValues.get(`stats:referrers:${date}`);
    if (dayRefs && typeof dayRefs === 'object') {
      for (const [domain, count] of Object.entries(dayRefs)) {
        referrers[domain] = (referrers[domain] || 0) + (count || 0);
      }
    }
  }

  // Compute previous/next month strings
  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nextMonth = nextDate <= now
    ? `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
    : null;

  return new Response(JSON.stringify({
    month: monthParam,
    prevMonth,
    nextMonth,
    days,
    totals,
    referrers,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
