import type { APIRoute } from 'astro';

export const prerender = false;

// Write-only sink for /diag client reports. No auth: reports are diagnostic
// breadcrumbs (no secrets), size-capped, TTL'd 24h in the FEEDBACK KV under
// diag:<id>. Read path is operator-side via `wrangler kv key get`.
export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  try {
    const raw = await context.request.text();
    if (!raw || raw.length > 32768) {
      return new Response(JSON.stringify({ ok: false, error: 'bad_size' }), { status: 400 });
    }
    let body: any;
    try { body = JSON.parse(raw); } catch {
      return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), { status: 400 });
    }
    const id = String(body.id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || String(Date.now());
    const record = {
      ts: new Date().toISOString(),
      ip: context.request.headers.get('CF-Connecting-IP') || '',
      country: context.request.headers.get('CF-IPCountry') || '',
      ua: context.request.headers.get('User-Agent') || '',
      steps: Array.isArray(body.steps) ? body.steps.slice(0, 100) : [],
    };
    await env.FEEDBACK.put('diag:' + id, JSON.stringify(record), { expirationTtl: 86400 });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err && err.message || err) }), { status: 500 });
  }
};
