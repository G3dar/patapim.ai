import type { APIRoute } from 'astro';
import { getUserFromRequest, createNativeSession } from '../../../lib/auth';

export const prerender = false;

// Mints a long-lived bearer token for the native iOS app. Authenticated via
// the session cookie (the caller is the patapim.ai/go page running inside
// ASWebAuthenticationSession right after Google sign-in). The token lets the
// app call /api/device/list and /api/device/connect-token natively, without
// the HttpOnly session cookie that Swift cannot read.
export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const headers = { 'Content-Type': 'application/json' };

  const user = await getUserFromRequest(env.SESSIONS, context.request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const token = await createNativeSession(env.SESSIONS, user);

  return new Response(JSON.stringify({
    token,
    email: user.email,
    name: user.name,
  }), { status: 200, headers });
};
