import type { APIRoute } from 'astro';
import {
  assertSameOrigin,
  getUserFromRequest,
  loadUserById,
  randomToken,
} from '../../../lib/auth';
import { rateLimit, clientIp, tooManyRequests } from '../../../lib/rateLimit';
import { sendEmailVerify } from '../../../lib/email';

export const prerender = false;

// Re-sends the verification email to the currently-logged-in user. Always
// succeeds from the caller's perspective (anti-enumeration not strictly
// needed since auth is required, but we still avoid leaking internal state).

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const siteUrl = env.SITE_URL || 'https://patapim.ai';

  if (!assertSameOrigin(context.request, siteUrl)) {
    return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = await getUserFromRequest(env.SESSIONS, context.request);
  if (!session) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthenticated' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const ip = clientIp(context.request);
  const ipLimit = await rateLimit(env.SESSIONS, `verify-resend:ip:${ip}`, { limit: 5, windowSeconds: 3600 });
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter);

  const user = await loadUserById(env.LICENSES, session.googleId);
  if (!user) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (user.emailVerified) {
    return new Response(JSON.stringify({ ok: true, alreadyVerified: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = randomToken(32);
  await env.SESSIONS.put(`email-verify:${token}`, JSON.stringify({ userId: user.googleId }), {
    expirationTtl: 86400,
  });
  const verifyUrl = `${siteUrl}/verify-email?token=${token}`;

  context.locals.runtime.ctx.waitUntil(
    sendEmailVerify(env, user.email, user.name, verifyUrl).catch((e) =>
      console.error('Verify email send failed:', e),
    ),
  );

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
