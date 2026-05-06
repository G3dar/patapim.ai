import type { APIRoute } from 'astro';
import {
  assertSameOrigin,
  buildSessionCookie,
  createSession,
  getUserFromRequest,
  loadUserById,
  pbkdf2Hash,
  pbkdf2Verify,
} from '../../../lib/auth';
import { validatePassword } from '../../../lib/passwordPolicy';
import { rateLimit, clientIp, tooManyRequests } from '../../../lib/rateLimit';

export const prerender = false;

interface RequestBody {
  currentPassword?: string;
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

  const session = await getUserFromRequest(env.SESSIONS, context.request);
  if (!session) return jsonError('unauthenticated', 401);

  const ip = clientIp(context.request);
  const ipLimit = await rateLimit(env.SESSIONS, `change-pw:ip:${ip}`, { limit: 10, windowSeconds: 3600 });
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter);

  let body: RequestBody;
  try { body = (await context.request.json()) as RequestBody; } catch { return jsonError('invalid_body'); }

  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';

  const errors = await validatePassword(newPassword);
  if (errors.length) return jsonError('invalid_password', 400, { details: errors });

  const user = await loadUserById(env.LICENSES, session.googleId);
  if (!user) return jsonError('user_not_found', 404);

  // If the user already has a password, require the current one. If not (a
  // Google-only user adding a password for the first time), allow without it.
  if (user.passwordHash) {
    if (!currentPassword) return jsonError('current_password_required');
    const ok = await pbkdf2Verify(user.passwordHash, currentPassword);
    if (!ok) return jsonError('invalid_credentials', 401);
  }

  const now = new Date().toISOString();
  user.passwordHash = await pbkdf2Hash(newPassword);
  user.passwordChangedAt = now;
  await env.LICENSES.put(`user:${user.googleId}`, JSON.stringify(user));

  // Issue a fresh session so the current browser stays logged in. Older
  // sessions are invalidated by the passwordChangedAt check.
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
