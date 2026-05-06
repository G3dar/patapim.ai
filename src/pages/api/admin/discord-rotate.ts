import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin';
import { rotateDiscordInvite } from '../../../lib/discord';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  const result = await rotateDiscordInvite(env, 'admin:' + auth.user.email);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status === 401 || result.status === 403 ? result.status : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, url: result.url, code: result.code }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
