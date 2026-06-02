/**
 * San Francisco geo-tracking helpers.
 *
 * Tracks page opens (with dwell time) and downloads coming from the SF Bay,
 * with extra attention to the downtown / Mission St corridor. Geo comes from
 * Cloudflare's request.cf object, which is city-level and approximate — treat
 * coordinates as a coarse signal, not a GPS fix.
 *
 * Storage (all in the LICENSES KV):
 *   sf:visit:<visitId>        — one record per page open, updated as dwell grows
 *   sf:download:<ts>-<rand>   — one record per download click
 */

// Downtown anchor: Mission St & 2nd, in the SoMa / Financial District core.
// "near Mission St" downtown is measured as distance from here.
export const MISSION_ST_DOWNTOWN = { lat: 37.7886, lon: -122.3998 };

// How close (km) counts as "downtown / near Mission St".
export const NEAR_MISSION_KM = 1.5;

// Rough SF city bounding box (lat/lon).
const SF_BBOX = { minLat: 37.70, maxLat: 37.84, minLon: -122.53, maxLon: -122.35 };

// Keep records for ~180 days so the dashboard stays bounded.
const RETENTION_SECONDS = 180 * 24 * 60 * 60;

export interface Geo {
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  lat?: number;
  lon?: number;
  colo?: string;       // Cloudflare edge datacenter
  timezone?: string;
  asOrg?: string;      // network / ISP
}

export interface SfClass {
  inSF: boolean;
  nearMission: boolean;
  distanceKm: number | null; // distance from the Mission St downtown anchor
}

/** Pull geo fields off a Cloudflare request. */
export function geoFromRequest(request: Request): Geo {
  const cf = (request as any).cf || {};
  const num = (v: unknown) => {
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    city: cf.city,
    region: cf.region,
    country: cf.country,
    postalCode: cf.postalCode,
    lat: num(cf.latitude),
    lon: num(cf.longitude),
    colo: cf.colo,
    timezone: cf.timezone,
    asOrg: cf.asOrganization,
  };
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Decide whether a geo is in SF and how close to downtown Mission St. */
export function classify(geo: Geo): SfClass {
  const hasCoords = typeof geo.lat === 'number' && typeof geo.lon === 'number';

  let inBox = false;
  if (hasCoords) {
    inBox =
      geo.lat! >= SF_BBOX.minLat &&
      geo.lat! <= SF_BBOX.maxLat &&
      geo.lon! >= SF_BBOX.minLon &&
      geo.lon! <= SF_BBOX.maxLon;
  }

  const cityIsSF =
    (geo.city || '').toLowerCase() === 'san francisco' &&
    (geo.country || '').toUpperCase() === 'US';

  const inSF = inBox || cityIsSF;

  let distanceKm: number | null = null;
  if (hasCoords) {
    distanceKm = haversineKm(geo.lat!, geo.lon!, MISSION_ST_DOWNTOWN.lat, MISSION_ST_DOWNTOWN.lon);
  }

  const nearMission = inSF && distanceKm !== null && distanceKm <= NEAR_MISSION_KM;

  return { inSF, nearMission, distanceKm: distanceKm === null ? null : Math.round(distanceKm * 100) / 100 };
}

export interface VisitRecord {
  kind: 'visit';
  visitId: string;
  path: string;
  ref: string;
  firstSeen: number;   // epoch ms
  lastSeen: number;    // epoch ms
  durationMs: number;  // dwell so far
  pings: number;
  geo: Geo;
  distanceKm: number | null;
  nearMission: boolean;
  ua: string;
}

export interface DownloadRecord {
  kind: 'download';
  ts: number;
  asset: string;
  ref: string;
  geo: Geo;
  distanceKm: number | null;
  nearMission: boolean;
  ua: string;
}

/** Upsert a visit record from a beacon. Returns the stored record. */
export async function recordVisit(
  kv: KVNamespace,
  opts: {
    visitId: string;
    event: 'open' | 'ping' | 'close';
    path: string;
    ref: string;
    durationMs: number;
    geo: Geo;
    cls: SfClass;
    ua: string;
  }
): Promise<void> {
  const key = `sf:visit:${opts.visitId}`;
  const now = Date.now();

  let rec: VisitRecord | null = null;
  const existing = await kv.get(key);
  if (existing) {
    try { rec = JSON.parse(existing) as VisitRecord; } catch { rec = null; }
  }

  if (!rec) {
    rec = {
      kind: 'visit',
      visitId: opts.visitId,
      path: opts.path,
      ref: opts.ref,
      firstSeen: now,
      lastSeen: now,
      durationMs: Math.max(0, opts.durationMs),
      pings: 0,
      geo: opts.geo,
      distanceKm: opts.cls.distanceKm,
      nearMission: opts.cls.nearMission,
      ua: opts.ua,
    };
  }

  rec.lastSeen = now;
  rec.durationMs = Math.max(rec.durationMs, Math.round(opts.durationMs) || 0);
  rec.pings += 1;
  // Refresh geo if a later beacon resolved better coords.
  if (opts.cls.distanceKm !== null) {
    rec.geo = opts.geo;
    rec.distanceKm = opts.cls.distanceKm;
    rec.nearMission = opts.cls.nearMission;
  }

  await kv.put(key, JSON.stringify(rec), { expirationTtl: RETENTION_SECONDS });
}

/** Log a download event from SF. */
export async function recordDownload(
  kv: KVNamespace,
  opts: { asset: string; ref: string; geo: Geo; cls: SfClass; ua: string }
): Promise<void> {
  const ts = Date.now();
  const rand = crypto.randomUUID().slice(0, 8);
  const rec: DownloadRecord = {
    kind: 'download',
    ts,
    asset: opts.asset,
    ref: opts.ref,
    geo: opts.geo,
    distanceKm: opts.cls.distanceKm,
    nearMission: opts.cls.nearMission,
    ua: opts.ua,
  };
  await kv.put(`sf:download:${ts}-${rand}`, JSON.stringify(rec), { expirationTtl: RETENTION_SECONDS });
}

/**
 * Convenience for download endpoints: classify the request and, if it's from
 * SF, log the download. Best-effort, never throws.
 */
export async function logSfDownload(env: any, request: Request, asset: string): Promise<void> {
  try {
    const geo = geoFromRequest(request);
    const cls = classify(geo);
    if (!cls.inSF) return;
    const ref = request.headers.get('referer') || '';
    const ua = request.headers.get('user-agent') || '';
    await recordDownload(env.LICENSES as KVNamespace, { asset, ref, geo, cls, ua });
  } catch {
    // best-effort
  }
}
