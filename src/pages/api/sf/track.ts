export const prerender = false;

import type { APIContext } from 'astro';
import { geoFromRequest, classify, recordVisit } from '../../../lib/sf';

/**
 * Lightweight beacon for SF visit tracking. The client posts an `open` event on
 * page load, periodic `ping`s, and a `close` on unload. Geo is derived from this
 * request's own Cloudflare cf object, so non-SF traffic is dropped here with
 * zero KV writes. The `open` response tells the client whether to keep beaconing.
 */
export async function POST(ctx: APIContext) {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return json({ tracked: false }, 400);
  }

  const event = body?.event === 'ping' || body?.event === 'close' ? body.event : 'open';
  const visitId = String(body?.visitId || '').slice(0, 64);
  if (!visitId) return json({ tracked: false }, 400);

  const geo = geoFromRequest(ctx.request);
  const cls = classify(geo);

  // Not SF — tell the client to stop, persist nothing.
  if (!cls.inSF) return json({ tracked: false });

  const path = String(body?.path || '').slice(0, 256);
  const ref = String(body?.ref || '').slice(0, 256);
  const durationMs = Math.max(0, Math.min(Number(body?.durationMs) || 0, 24 * 60 * 60 * 1000));
  const ua = (ctx.request.headers.get('user-agent') || '').slice(0, 256);

  const env = ctx.locals.runtime.env as any;
  await recordVisit(env.LICENSES as KVNamespace, {
    visitId,
    event,
    path,
    ref,
    durationMs,
    geo,
    cls,
    ua,
  });

  return json({ tracked: true, nearMission: cls.nearMission });
}
