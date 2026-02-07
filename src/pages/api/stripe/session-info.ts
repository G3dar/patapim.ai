import type { APIRoute } from 'astro';
import Stripe from 'stripe';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const headers = { 'Content-Type': 'application/json' };

  let body: { sessionId?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const { sessionId } = body;
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'sessionId required' }), { status: 400, headers });
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const email = session.customer_email || session.customer_details?.email || '';

    if (!email) {
      return new Response(JSON.stringify({ error: 'No email found for session' }), { status: 404, headers });
    }

    const raw = await env.LICENSES.get(`license:${email}`);
    if (!raw) {
      return new Response(JSON.stringify({ found: false, email }), { status: 200, headers });
    }

    const license = JSON.parse(raw);
    return new Response(JSON.stringify({
      found: true,
      email,
      licenseKey: license.licenseKey,
      plan: license.plan,
      status: license.status,
    }), { status: 200, headers });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
