import type { APIRoute } from 'astro';
import {
  assertSameOrigin,
  loadUserByEmail,
  normalizeEmail,
  randomToken,
} from '../../../lib/auth';
import { rateLimit, clientIp, tooManyRequests } from '../../../lib/rateLimit';
import { sendPasswordReset, sendEmailVerify } from '../../../lib/email';

export const prerender = false;

interface RequestBody {
  email?: string;
}

// Always returns { ok: true } regardless of whether the email exists, to avoid
// account enumeration. Errors only surface for malformed requests.

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const siteUrl = env.SITE_URL || 'https://patapim.ai';

  if (!assertSameOrigin(context.request, siteUrl)) {
    return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  const ip = clientIp(context.request);
  const ipLimit = await rateLimit(env.SESSIONS, `reset:ip:${ip}`, { limit: 10, windowSeconds: 3600 });
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter);

  let body: RequestBody;
  try {
    body = (await context.request.json()) as RequestBody;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  if (!email) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_email' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const emailLimit = await rateLimit(env.SESSIONS, `reset:email:${email}`, { limit: 3, windowSeconds: 3600 });
  if (!emailLimit.ok) {
    // Still respond ok=true to keep the response shape uniform — the
    // attacker's clock is what matters, not the response.
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await loadUserByEmail(env.LICENSES, email);

  // Run the email work in waitUntil so the response time is constant whether
  // or not the user exists (constant-ish; mail providers add jitter).
  context.locals.runtime.ctx.waitUntil((async () => {
    if (!user) return; // Silent — anti-enumeration.
    if (!user.passwordHash) return; // Google-only account; nothing to reset.

    if (!user.emailVerified) {
      // Soft-verify policy: don't allow resets on unverified emails. Send a
      // verification link instead so the user can prove ownership and try
      // again. The same link does double duty.
      const vToken = randomToken(32);
      await env.SESSIONS.put(`email-verify:${vToken}`, JSON.stringify({ userId: user.googleId }), {
        expirationTtl: 86400,
      });
      const vUrl = `${siteUrl}/verify-email?token=${vToken}&intent=reset`;
      try {
        await sendEmailVerify(env, user.email, user.name, vUrl);
      } catch (e) {
        console.error('Verify-then-reset email failed:', e);
      }
      return;
    }

    const token = randomToken(32);
    await env.SESSIONS.put(`pw-reset:${token}`, JSON.stringify({
      userId: user.googleId,
      requestedAt: new Date().toISOString(),
    }), { expirationTtl: 3600 });

    const resetUrl = `${siteUrl}/reset-password?token=${token}`;
    try {
      await sendPasswordReset(env, user.email, user.name, resetUrl);
    } catch (e) {
      console.error('Password reset email failed:', e);
    }
  })());

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
