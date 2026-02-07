import type { APIRoute } from 'astro';
import { getUserFromRequest } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const user = await getUserFromRequest(env.SESSIONS, context.request);

  if (!user) {
    return new Response(JSON.stringify({ authenticated: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    authenticated: true,
    user: { name: user.name, email: user.email, picture: user.picture },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
