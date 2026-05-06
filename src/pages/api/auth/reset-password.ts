import type { APIRoute } from 'astro';
import {
  assertSameOrigin,
  buildSessionCookie,
  createSession,
  loadUserById,
  pbkdf2Hash,
} from '../../../lib/auth';
import { validatePassword } from '../../../lib/passwordPolicy';
import { rateLimit, clientIp, tooManyRequests } from '../../../lib/rateLimit';

export const prerender = false;

interface RequestBody {
  token?: string;
  newPassword?: string;
}

function jsonError(error: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const siteUrl = env.SITE_URL || 'https://patapim.ai';

  if (!assertSameOrigin(context.request, siteUrl)) return jsonError('forbidden', 403);

  const ip = clientIp(context.request);
  const ipLimit = await rateLimit(env.SESSIONS, `reset-confirm:ip:${ip}`, { limit: 20, windowSeconds: 3600 });
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter);

  let body: RequestBody;
  try {
    body = (await context.request.json()) as RequestBody;
  } catch {
    return jsonError('invalid_body');
  }

  const token = typeof body.token === 'string' ? body.token : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (!token) return jsonError('invalid_token');

  const errors = await validatePassword(newPassword);
  if (errors.length) return jsonError('invalid_password', 400, { details: errors });

  const raw = await env.SESSIONS.get(`pw-reset:${token}`);
  if (!raw) return jsonError('invalid_or_expired_token', 400);

  let payload: { userId: string };
  try { payload = JSON.parse(raw); } catch { return jsonError('invalid_or_expired_token', 400); }

  const user = await loadUserById(env.LICENSES, payload.userId);
  if (!user) return jsonError('invalid_or_expired_token', 400);

  const now = new Date().toISOString();
  user.passwordHash = await pbkdf2Hash(newPassword);
  user.passwordChangedAt = now;
  // Clicking the reset link proves email control.
  if (!user.emailVerified) {
    user.emailVerified = true;
    user.emailVerifiedAt = now;
  }

  await env.LICENSES.put(`user:${user.googleId}`, JSON.stringify(user));
  await env.SESSIONS.delete(`pw-reset:${token}`);

  // Mint a fresh session for the user — older sessions are invalidated by the
  // passwordChangedAt check inside getValidSession().
  const sessionId = await createSession(env.SESSIONS, {
    googleId: user.googleId,
    email: user.email,
    name: user.name,
    picture: user.picture,
  });

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', buildSessionCookie(sessionId));

  return new Response(JSON.stringify({
    ok: true,
    user: {
      email: user.email,
      name: user.name,
      picture: user.picture,
      emailVerified: !!user.emailVerified,
      hasPassword: true,
      googleLinked: !!user.linkedGoogleId,
    },
  }), { status: 200, headers });
};
