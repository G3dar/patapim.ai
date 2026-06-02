import type { APIRoute } from 'astro';
import { requireAdmin, listAllKeys, fetchAllValues } from '../../../lib/admin';
import type { VisitRecord, DownloadRecord } from '../../../lib/sf';
import { MISSION_ST_DOWNTOWN, NEAR_MISSION_KM } from '../../../lib/sf';

export const prerender = false;

interface Event {
  type: 'visit' | 'download';
  time: number;
  lastSeen?: number;
  durationMs?: number;
  path?: string;
  ref?: string;
  asset?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  distanceKm: number | null;
  nearMission: boolean;
  lat?: number;
  lon?: number;
  colo?: string;
  asOrg?: string;
  ua?: string;
}

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  const kv = env.LICENSES as KVNamespace;

  const [visitKeys, downloadKeys] = await Promise.all([
    listAllKeys(kv, 'sf:visit:'),
    listAllKeys(kv, 'sf:download:'),
  ]);

  const [visitVals, downloadVals] = await Promise.all([
    fetchAllValues<VisitRecord>(kv, visitKeys.map((k) => k.name)),
    fetchAllValues<DownloadRecord>(kv, downloadKeys.map((k) => k.name)),
  ]);

  const events: Event[] = [];

  for (const v of visitVals.values()) {
    events.push({
      type: 'visit',
      time: v.firstSeen,
      lastSeen: v.lastSeen,
      durationMs: v.durationMs,
      path: v.path,
      ref: v.ref,
      city: v.geo?.city,
      region: v.geo?.region,
      postalCode: v.geo?.postalCode,
      distanceKm: v.distanceKm,
      nearMission: v.nearMission,
      lat: v.geo?.lat,
      lon: v.geo?.lon,
      colo: v.geo?.colo,
      asOrg: v.geo?.asOrg,
      ua: v.ua,
    });
  }

  for (const d of downloadVals.values()) {
    events.push({
      type: 'download',
      time: d.ts,
      asset: d.asset,
      ref: d.ref,
      city: d.geo?.city,
      region: d.geo?.region,
      postalCode: d.geo?.postalCode,
      distanceKm: d.distanceKm,
      nearMission: d.nearMission,
      lat: d.geo?.lat,
      lon: d.geo?.lon,
      colo: d.geo?.colo,
      asOrg: d.geo?.asOrg,
      ua: d.ua,
    });
  }

  events.sort((a, b) => b.time - a.time);

  // ---- aggregates ----
  const visits = events.filter((e) => e.type === 'visit');
  const downloads = events.filter((e) => e.type === 'download');

  const dwellValues = visits.map((v) => v.durationMs || 0).filter((d) => d > 0).sort((a, b) => a - b);
  const avgDwell = dwellValues.length
    ? Math.round(dwellValues.reduce((s, d) => s + d, 0) / dwellValues.length)
    : 0;
  const medianDwell = dwellValues.length
    ? dwellValues[Math.floor(dwellValues.length / 2)]
    : 0;

  // Per-day buckets (UTC date) for the last 30 days.
  const byDay: Record<string, { visits: number; downloads: number; missionVisits: number; missionDownloads: number }> = {};
  const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  for (const e of events) {
    const day = dayOf(e.time);
    if (!byDay[day]) byDay[day] = { visits: 0, downloads: 0, missionVisits: 0, missionDownloads: 0 };
    if (e.type === 'visit') {
      byDay[day].visits++;
      if (e.nearMission) byDay[day].missionVisits++;
    } else {
      byDay[day].downloads++;
      if (e.nearMission) byDay[day].missionDownloads++;
    }
  }

  const tally = (arr: Event[], pick: (e: Event) => string | undefined) => {
    const m: Record<string, number> = {};
    for (const e of arr) {
      const k = pick(e);
      if (!k) continue;
      m[k] = (m[k] || 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10);
  };

  const summary = {
    visits: {
      total: visits.length,
      mission: visits.filter((v) => v.nearMission).length,
      avgDwellMs: avgDwell,
      medianDwellMs: medianDwell,
    },
    downloads: {
      total: downloads.length,
      mission: downloads.filter((d) => d.nearMission).length,
    },
    topCities: tally(events, (e) => e.city),
    topPaths: tally(visits, (e) => e.path),
    topReferrers: tally(visits, (e) => (e.ref ? hostOf(e.ref) : 'direct')),
    topNetworks: tally(events, (e) => e.asOrg),
  };

  return new Response(
    JSON.stringify({
      summary,
      byDay,
      events: events.slice(0, 500),
      anchor: MISSION_ST_DOWNTOWN,
      nearKm: NEAR_MISSION_KM,
      generatedAt: Date.now(),
    }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
  );
};

function hostOf(ref: string): string {
  try {
    return new URL(ref).hostname.replace(/^www\./, '') || 'direct';
  } catch {
    return ref || 'direct';
  }
}
