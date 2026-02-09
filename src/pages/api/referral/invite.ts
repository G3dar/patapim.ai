import type { APIRoute } from 'astro';
import { createReferralAssociation } from '../../../lib/referral';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  let body: { email?: string; friendEmail?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const { email, friendEmail } = body;
  if (!email || !friendEmail) {
    return new Response(JSON.stringify({ error: 'email and friendEmail required' }), { status: 400, headers });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || !emailRegex.test(friendEmail)) {
    return new Response(JSON.stringify({ error: 'Invalid email format' }), { status: 400, headers });
  }

  const result = await createReferralAssociation(env.LICENSES, email, friendEmail);

  if (!result.created) {
    return new Response(JSON.stringify({ error: result.reason }), { status: 400, headers });
  }

  return new Response(JSON.stringify({
    success: true,
  }), { status: 200, headers });
};
