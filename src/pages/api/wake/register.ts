import type { APIRoute } from 'astro';
import { getUserFromRequestOrDeviceToken, randomToken } from '../../../lib/auth';

export const prerender = false;

/**
 * Mint (or return) this account's Wake-on-LAN agent token.
 *
 * An always-on LAN device (a Flic Hub SDK module, or another awake PATAPIM)
 * polls GET /api/wake/poll?token=<agentToken> and fires the magic packet for
 * any pending wakes. The token is a bearer secret tied to the account; the
 * agent lives on the user's LAN so it can broadcast to a sleeping machine.
 *
 * Idempotent: the same account always gets the same token back, so re-running
 * setup never orphans a previously-configured Hub.
 */
export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const headers = { 'Content-Type': 'application/json' };

  const user = await getUserFromRequestOrDeviceToken(env.SESSIONS, env.LICENSES, context.request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const existing = await env.LICENSES.get(`wake-agent-account:${user.googleId}`);
  if (existing) {
    return new Response(JSON.stringify({ token: existing }), { status: 200, headers });
  }

  const token = 'wa_' + randomToken(24);
  await env.LICENSES.put(
    `wake-agent:${token}`,
    JSON.stringify({ googleId: user.googleId, email: user.email, createdAt: new Date().toISOString() }),
  );
  await env.LICENSES.put(`wake-agent-account:${user.googleId}`, token);

  return new Response(JSON.stringify({ token }), { status: 200, headers });
};
