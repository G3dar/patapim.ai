import type { APIRoute } from 'astro';
import { STATE_TTL } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const url = new URL(context.request.url);
  const state = crypto.randomUUID();

  // Store state value — include beta code if present so it survives OAuth round-trip
  const betaCode = url.searchParams.get('beta') || '';
  const stateValue = betaCode ? JSON.stringify({ beta: betaCode }) : 'true';
  await env.SESSIONS.put(`oauth_state:${state}`, stateValue, { expirationTtl: STATE_TTL });

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
