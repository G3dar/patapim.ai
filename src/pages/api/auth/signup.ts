import type { APIRoute } from 'astro';
import {
  assertSameOrigin,
  buildSessionCookie,
  createSession,
  loadUserByEmail,
  normalizeEmail,
  pbkdf2Hash,
  randomToken,
  saveUser,
  type UserRecord,
} from '../../../lib/auth';
import { validatePassword } from '../../../lib/passwordPolicy';
import { rateLimit, clientIp, tooManyRequests } from '../../../lib/rateLimit';
import { sendWelcomeAndVerify } from '../../../lib/email';
import { completePairingIfPresent } from '../../../lib/pairing';

export const prerender = false;

interface SignupBody {
  email?: string;
  password?: string;
  name?: string;
}

function jsonError(error: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const siteUrl = env.SITE_URL || 'https://patapim.ai';

  if (!assertSameOrigin(context.request, siteUrl)) {
    return jsonError('forbidden', 403);
  }

  let body: SignupBody;
  try {
    body = (await context.request.json()) as SignupBody;
  } catch {
    return jsonError('invalid_body');
  }

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';

  if (!email || !EMAIL_RE.test(email)) return jsonError('invalid_email');
  const passwordErrors = await validatePassword(password);
  if (passwordErrors.length) return jsonError('invalid_password', 400, { details: passwordErrors });

  // Rate limit AFTER input validation so users iterating on a password (HIBP
  // rejections, "too short", etc.) don't burn through their quota on
  // attempts that never had a chance of creating an account.
  const ip = clientIp(context.request);
  const ipLimit = await rateLimit(env.SESSIONS, `signup:ip:${ip}`, { limit: 5, windowSeconds: 3600 });
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter);

  // Reject if email already has an account (whether Google-linked or not).
  const existing = await loadUserByEmail(env.LICENSES, email);
  if (existing) {
    if (existing.linkedGoogleId && !existing.passwordHash) {
      return jsonError('email_in_use', 409, { hint: 'google_only' });
    }
    return jsonError('email_in_use', 409);
  }

  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  const passwordHash = await pbkdf2Hash(password);

  const user: UserRecord = {
    googleId: userId, // for password-only users, googleId === userId (UUID)
    email,
    name: name || email.split('@')[0],
    picture: '',
    createdAt: now,
    lastLogin: now,
    emailVerified: false,
    passwordHash,
    passwordChangedAt: now,
  };

  await saveUser(env.LICENSES, user);

  // Mint a verification token (24h) and dispatch the welcome+verify email.
  const verifyToken = randomToken(32);
  await env.SESSIONS.put(`email-verify:${verifyToken}`, JSON.stringify({ userId }), {
    expirationTtl: 86400,
  });
  const verifyUrl = `${siteUrl}/verify-email?token=${verifyToken}`;
  context.locals.runtime.ctx.waitUntil(
    sendWelcomeAndVerify(env, email, user.name, verifyUrl).catch((e) =>
      console.error('Welcome email failed:', e),
    ),
  );

  // Stats: count signup
  context.locals.runtime.ctx.waitUntil((async () => {
    try {
      const today = now.slice(0, 10);
      const raw = await env.LICENSES.get(`stats:signups:${today}`);
      await env.LICENSES.put(`stats:signups:${today}`, String((parseInt(raw || '0', 10) || 0) + 1));
    } catch {
      // best-effort
    }
  })());

  // Session + desktop-pairing handoff
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
      emailVerified: false,
      hasPassword: true,
      googleLinked: false,
    },
  }), { status: 200, headers });
};
