import type { APIRoute } from 'astro';
import { parseCookie, deleteSession, buildClearCookie } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const sessionId = parseCookie(context.request);

  if (sessionId) {
    await deleteSession(env.SESSIONS, sessionId);
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildClearCookie(),
    },
  });
};
