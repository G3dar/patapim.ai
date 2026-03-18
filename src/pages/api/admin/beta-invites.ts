import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  const kv = env.LICENSES;

  const [generatedRaw, claimedRaw, listRaw] = await Promise.all([
    kv.get('beta:generated'),
    kv.get('beta:claimed'),
    kv.get('beta:invites-list'),
  ]);

  const generated = parseInt(generatedRaw || '0', 10) || 0;
  const claimed = parseInt(claimedRaw || '0', 10) || 0;
  const invites = listRaw ? JSON.parse(listRaw) : [];

  return new Response(JSON.stringify({
    generated,
    claimed,
    max: 50,
    invites,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
