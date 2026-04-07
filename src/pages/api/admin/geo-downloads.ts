import type { APIRoute } from 'astro';
import { requireAdmin, listAllKeys, fetchAllValues } from '../../../lib/admin';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  const kv = env.LICENSES;
  const url = new URL(context.request.url);
  const from = url.searchParams.get('from'); // YYYY-MM-DD
  const to = url.searchParams.get('to');     // YYYY-MM-DD

  // If no date filters, return all-time geo totals (existing keys)
  if (!from && !to) {
    const geoKeys = await listAllKeys(kv, 'stats:downloads:geo:');
    const geoValues = await fetchAllValues<string>(kv, geoKeys.map(k => k.name));
    const geo: Record<string, number> = {};
    for (const [key, val] of geoValues) {
      // Only all-time keys: stats:downloads:geo:XX (not stats:downloads:geo:XX:YYYY-MM-DD)
      const suffix = key.replace('stats:downloads:geo:', '');
      if (suffix.length === 2) {
        geo[suffix] = parseInt(String(val), 10) || 0;
      }
    }
    return new Response(JSON.stringify({ geo }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Date-filtered: fetch all per-date geo keys and sum within range
  const geoKeys = await listAllKeys(kv, 'stats:downloads:geo:');
  const geoValues = await fetchAllValues<string>(kv, geoKeys.map(k => k.name));
  const geo: Record<string, number> = {};

  for (const [key, val] of geoValues) {
    const suffix = key.replace('stats:downloads:geo:', '');
    // Per-date keys look like: XX:YYYY-MM-DD
    const match = suffix.match(/^([A-Z]{2}):(\d{4}-\d{2}-\d{2})$/);
    if (!match) continue;

    const [, country, date] = match;
    if (from && date < from) continue;
    if (to && date > to) continue;

    geo[country] = (geo[country] || 0) + (parseInt(String(val), 10) || 0);
  }

  return new Response(JSON.stringify({ geo }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
