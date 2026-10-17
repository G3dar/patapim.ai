import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';
import { getUserFromRequestOrDeviceToken } from '../../../lib/auth';
import { apnsConfigured, apnsHost, apnsTopic, loadPushTokens } from '../../../lib/apns';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

// Push diagnostics for the mobile app's Settings screen (Bearer nt_) and the
// desktop (Bearer deviceToken). Never reveals secret values — only whether the
// three APNs secrets are present and how many tokens this account has.
//
// GET /api/push/status →
//   200 { configured, tokens, sandboxTokens, productionTokens, host, sandboxHost, topic }
//   401 { error:'Unauthorized' }
export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...getCorsHeaders(context.request),
  };

  const user = await getUserFromRequestOrDeviceToken(env.SESSIONS, env.LICENSES, context.request);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

  const list = await loadPushTokens(env.LICENSES, user.googleId);
  const sandboxTokens = list.filter((t) => t.environment === 'sandbox').length;

  return new Response(JSON.stringify({
    configured: apnsConfigured(env),
    tokens: list.length,
    sandboxTokens,
    productionTokens: list.length - sandboxTokens,
    host: apnsHost(env, 'production'),
    sandboxHost: apnsHost(env, 'sandbox'),
    topic: apnsTopic(env),
  }), { status: 200, headers });
};
