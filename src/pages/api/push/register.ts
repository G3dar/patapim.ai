import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';
import { getUserFromRequestOrDeviceToken } from '../../../lib/auth';
import { loadPushTokens, normalizeEnvironment, pushTokensKey } from '../../../lib/apns';
import type { PushTokenRecord } from '../../../lib/apns';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

// Register a mobile push token for the authenticated account (Bearer nt_ from
// the app). Stored at LICENSES `push:<googleId>` as a small deduped list.
//
// Body: { platform?: 'ios'|'android', token: string, environment?: 'production'|'sandbox' }
// `environment` tells notify.ts which APNs host this token belongs to: a
// dev-signed build (aps-environment=development) yields SANDBOX tokens that
// the production host rejects as BadDeviceToken. Omitted → 'production'.
const MAX_TOKENS = 10;

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const headers = { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) };

  const user = await getUserFromRequestOrDeviceToken(env.SESSIONS, env.LICENSES, context.request);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

  // request.json() resolves (not rejects) for the literal bodies `null`, `true`,
  // `5` or `"x"`; only a real object may be dereferenced below.
  type RegisterBody = { platform?: unknown; token?: unknown; environment?: unknown };
  let body: RegisterBody | null = null;
  try {
    const parsed: unknown = await context.request.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as RegisterBody;
  } catch { /* fallthrough: body stays null */ }
  if (!body) {
    return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400, headers });
  }
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const platform: PushTokenRecord['platform'] = body.platform === 'android' ? 'android' : 'ios';
  if (!token || token.length > 256 || !/^[a-zA-Z0-9_:-]+$/.test(token)) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 400, headers });
  }
  if (body.environment !== undefined && body.environment !== 'production' && body.environment !== 'sandbox') {
    return new Response(JSON.stringify({ error: 'Invalid environment' }), { status: 400, headers });
  }
  const environment = normalizeEnvironment(body.environment);

  const key = pushTokensKey(user.googleId);
  let list = await loadPushTokens(env.LICENSES, user.googleId);
  list = list.filter((t) => t.token !== token);
  list.push({ token, platform, environment, addedAt: new Date().toISOString() });
  while (list.length > MAX_TOKENS) list.shift();
  await env.LICENSES.put(key, JSON.stringify(list));

  return new Response(JSON.stringify({ ok: true, count: list.length, environment }), { status: 200, headers });
};
