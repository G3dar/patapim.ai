import type { APIRoute } from 'astro';
import { activateReferral } from '../../../lib/referral';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  let body: { email?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const { email } = body;
  if (!email) {
    return new Response(JSON.stringify({ error: 'email required' }), { status: 400, headers });
  }

  const result = await activateReferral(env.LICENSES, email);

  if (!result.activated) {
    return new Response(JSON.stringify({ claimed: false, reason: result.reason }), { status: 200, headers });
  }

  return new Response(JSON.stringify({
    claimed: true,
    rewardGranted: result.rewardGranted || false,
  }), { status: 200, headers });
};
