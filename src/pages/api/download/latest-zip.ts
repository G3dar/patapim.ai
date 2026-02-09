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

  const fileObj = await bucket.get(manifest.zipFile);

  if (!fileObj) {
    return new Response(JSON.stringify({ error: 'ZIP file not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Increment download counters without slowing the response
  const today = new Date().toISOString().slice(0, 10);
  ctx.locals.runtime.ctx.waitUntil((async () => {
    try {
      const kv = env.LICENSES as KVNamespace;
      const [totalRaw, dailyRaw] = await Promise.all([
        kv.get('stats:downloads:total'),
        kv.get(`stats:downloads:${today}`),
      ]);
      await Promise.all([
        kv.put('stats:downloads:total', String((parseInt(totalRaw || '0', 10) || 0) + 1)),
        kv.put(`stats:downloads:${today}`, String((parseInt(dailyRaw || '0', 10) || 0) + 1)),
      ]);
    } catch {
      // Best-effort counter, don't fail the download
    }
  })());

  return new Response(fileObj.body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${manifest.zipFile}"`,
      'Content-Length': String(fileObj.size),
      'Cache-Control': 'public, max-age=3600',
      'X-Patapim-Version': manifest.version,
    },
  });
}
