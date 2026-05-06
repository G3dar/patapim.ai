import type { APIRoute } from 'astro';
import { assertSameOrigin, loadUserById } from '../../../lib/auth';
import { rateLimit, clientIp, tooManyRequests } from '../../../lib/rateLimit';

export const prerender = false;

interface RequestBody {
  token?: string;
}

function jsonError(error: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const siteUrl = env.SITE_URL || 'https://patapim.ai';

  if (!assertSameOrigin(context.request, siteUrl)) return jsonError('forbidden', 403);

  const ip = clientIp(context.request);
  const ipLimit = await rateLimit(env.SESSIONS, `verify:ip:${ip}`, { limit: 30, windowSeconds: 3600 });
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter);

  let body: RequestBody;
  try { body = (await context.request.json()) as RequestBody; } catch { return jsonError('invalid_body'); }

  const token = typeof body.token === 'string' ? body.token : '';
  if (!token) return jsonError('invalid_token');

  const raw = await env.SESSIONS.get(`email-verify:${token}`);
  if (!raw) return jsonError('invalid_or_expired_token', 400);

  let payload: { userId: string };
  try { payload = JSON.parse(raw); } catch { return jsonError('invalid_or_expired_token', 400); }

  const user = await loadUserById(env.LICENSES, payload.userId);
  if (!user) return jsonError('invalid_or_expired_token', 400);

  if (!user.emailVerified) {
    user.emailVerified = true;
    user.emailVerifiedAt = new Date().toISOString();
    await env.LICENSES.put(`user:${user.googleId}`, JSON.stringify(user));
  }

  await env.SESSIONS.delete(`email-verify:${token}`);

  return new Response(JSON.stringify({ ok: true, email: user.email }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
