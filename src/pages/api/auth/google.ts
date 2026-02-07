import type { APIRoute } from 'astro';
import { STATE_TTL } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const state = crypto.randomUUID();

  await env.SESSIONS.put(`oauth_state:${state}`, 'true', { expirationTtl: STATE_TTL });

  const siteUrl = env.SITE_URL || 'https://patapim.ai';
  const redirectUri = `${siteUrl}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  return new Response(null, {
    status: 302,
    headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` },
  });
};
