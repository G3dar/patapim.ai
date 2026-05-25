export const prerender = false;

import type { APIContext } from 'astro';

export async function GET(ctx: APIContext) {
  const env = ctx.locals.runtime.env as any;
  const bucket: R2Bucket = env.RELEASES;

  const manifestObj = await bucket.get('latest.json');
  if (!manifestObj) {
    return new Response(JSON.stringify({ error: 'No releases available yet' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const manifest = await manifestObj.json<{ version: string; file: string; zipFile?: string; notes: string }>();

  if (!manifest.zipFile) {
    return new Response(JSON.stringify({ error: 'ZIP distribution not available' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // The Windows portable .zip is >300 MiB, which exceeds wrangler's R2 upload
  // cap (`wrangler r2 object put` rejects files over 300 MiB), so the release
  // pipeline can't mirror it to R2 and a bucket.get() here always missed -> 404.
  // Serve it straight from the PUBLIC GitHub release (G3dar/patapim-releases)
  // instead — the same place electron-updater already downloads from anonymously.
  // The 302 keeps this URL stable and always points at the current version.
  const RELEASES_REPO = 'G3dar/patapim-releases';
  const githubUrl = `https://github.com/${RELEASES_REPO}/releases/download/v${manifest.version}/${manifest.zipFile}`;

  // Increment download counters without slowing the response
  const today = new Date().toISOString().slice(0, 10);
  const cf = (ctx.request as any).cf;
  const country = cf?.country as string | undefined;
  ctx.locals.runtime.ctx.waitUntil((async () => {
    try {
      const kv = env.LICENSES as KVNamespace;
      const reads: Promise<string | null>[] = [
        kv.get('stats:downloads:total'),
        kv.get(`stats:downloads:${today}`),
      ];
      if (country && country.length === 2) {
        reads.push(kv.get(`stats:downloads:geo:${country}`));
        reads.push(kv.get(`stats:downloads:geo:${country}:${today}`));
      }
      const [totalRaw, dailyRaw, geoRaw, geoDailyRaw] = await Promise.all(reads);
      const puts: Promise<void>[] = [
        kv.put('stats:downloads:total', String((parseInt(totalRaw || '0', 10) || 0) + 1)),
        kv.put(`stats:downloads:${today}`, String((parseInt(dailyRaw || '0', 10) || 0) + 1)),
      ];
      if (country && country.length === 2) {
        puts.push(kv.put(`stats:downloads:geo:${country}`, String((parseInt(geoRaw || '0', 10) || 0) + 1)));
        puts.push(kv.put(`stats:downloads:geo:${country}:${today}`, String((parseInt(geoDailyRaw || '0', 10) || 0) + 1)));
      }
      await Promise.all(puts);
    } catch {
      // Best-effort counter, don't fail the download
    }
  })());

  return new Response(null, {
    status: 302,
    headers: {
      Location: githubUrl,
      'Cache-Control': 'public, max-age=300',
      'X-Patapim-Version': manifest.version,
    },
  });
}
