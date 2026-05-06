import type { APIRoute } from 'astro';
import {
  assertSameOrigin,
  buildSessionCookie,
  createSession,
  loadUserByEmail,
  normalizeEmail,
  pbkdf2Verify,
} from '../../../lib/auth';
import { rateLimit, clientIp, tooManyRequests } from '../../../lib/rateLimit';
import { completePairingIfPresent } from '../../../lib/pairing';

export const prerender = false;

interface LoginBody {
  email?: string;
  password?: string;
}

function jsonError(error: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const GENERIC_FAIL = { error: 'invalid_credentials' };

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const siteUrl = env.SITE_URL || 'https://patapim.ai';

  if (!assertSameOrigin(context.request, siteUrl)) {
    return jsonError('forbidden', 403);
  }

  const ip = clientIp(context.request);
  const ipLimit = await rateLimit(env.SESSIONS, `login:ip:${ip}`, { limit: 20, windowSeconds: 3600 });
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter);

  let body: LoginBody;
  try {
    body = (await context.request.json()) as LoginBody;
  } catch {
    return jsonError('invalid_body');
  }

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return new Response(JSON.stringify({ ok: false, ...GENERIC_FAIL }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const emailLimit = await rateLimit(env.SESSIONS, `login:email:${email}`, { limit: 5, windowSeconds: 900 });
  if (!emailLimit.ok) return tooManyRequests(emailLimit.retryAfter);

  const user = await loadUserByEmail(env.LICENSES, email);
  if (!user) {
    return new Response(JSON.stringify({ ok: false, ...GENERIC_FAIL }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Google-only user trying to use password — generic error + a hint flag the
  // UI can use to suggest the Google button. (Hint doesn't disclose existence;
  // a non-existent email lands in the same branch above.)
  if (!user.passwordHash) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_credentials', hint: 'google_only' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const ok = await pbkdf2Verify(user.passwordHash, password);
  if (!ok) {
    return new Response(JSON.stringify({ ok: false, ...GENERIC_FAIL }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  user.lastLogin = new Date().toISOString();
  // saveUser also refreshes indexes, but we only changed lastLogin so a direct
  // put is enough and keeps writes minimal.
  await env.LICENSES.put(`user:${user.googleId}`, JSON.stringify(user));

  const sessionId = await createSession(env.SESSIONS, {
    googleId: user.googleId,
    email: user.email,
    name: user.name,
    picture: user.picture,
  });

  const pairClearCookie = await completePairingIfPresent(env, context.request, {
    googleId: user.googleId,
    email: user.email,
  });

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', buildSessionCookie(sessionId));
  if (pairClearCookie) headers.append('Set-Cookie', pairClearCookie);

  return new Response(JSON.stringify({
    ok: true,
    paired: !!pairClearCookie,
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
