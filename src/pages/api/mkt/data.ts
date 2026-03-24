import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  const result = await requireAdmin(env.SESSIONS, request);
  if ('response' in result) return result.response;

  const raw = await env.LICENSES.get('mkt:dashboard');
  if (!raw) {
    return new Response(JSON.stringify({ error: 'No data yet. Start the local dashboard and it will push automatically.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(raw, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
};
