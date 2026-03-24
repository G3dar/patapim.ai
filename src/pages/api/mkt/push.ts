import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  // Auth: bearer token (for local server push) OR admin session
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (!env.MKT_PUSH_SECRET || token !== env.MKT_PUSH_SECRET) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
  } else {
    // Fall back to admin session check
    const { requireAdmin } = await import('../../../lib/admin');
    const result = await requireAdmin(env.SESSIONS, request);
    if ('response' in result) return result.response;
  }

  const body = await request.text();
  if (!body || body.length > 512_000) {
    return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Validate it's valid JSON
  try { JSON.parse(body); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  await env.LICENSES.put('mkt:dashboard', body);

  return new Response(JSON.stringify({ ok: true, size: body.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
