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

  const manifest = await manifestObj.json<{ version: string; file: string; notes: string }>();
  const fileObj = await bucket.get(manifest.file);

  if (!fileObj) {
    return new Response(JSON.stringify({ error: 'Installer file not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(fileObj.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${manifest.file}"`,
      'Content-Length': String(fileObj.size),
      'Cache-Control': 'public, max-age=3600',
      'X-Patapim-Version': manifest.version,
    },
  });
}
