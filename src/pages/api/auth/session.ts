import type { APIRoute } from 'astro';
import { getUserFromRequest, loadUserById } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const session = await getUserFromRequest(env.SESSIONS, context.request);

  if (!session) {
    return new Response(JSON.stringify({ authenticated: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Look up the user record so we can return account-state flags the UI uses
  // to drive prompts (set a password, verify email).
  const user = await loadUserById(env.LICENSES, session.googleId);

  return new Response(JSON.stringify({
    authenticated: true,
    user: {
      name: session.name,
      email: session.email,
      picture: session.picture,
      emailVerified: user ? !!user.emailVerified : false,
      hasPassword: user ? !!user.passwordHash : false,
      googleLinked: user ? !!user.linkedGoogleId || !user.passwordHash : true,
    },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
