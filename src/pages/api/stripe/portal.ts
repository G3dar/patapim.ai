import type { APIRoute } from 'astro';
import Stripe from 'stripe';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  let body: { email?: string; customerId?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { email, customerId } = body;
  let stripeCustomerId = customerId;

  if (!stripeCustomerId && email) {
    const raw = await env.LICENSES.get(`license:${email}`);
    if (!raw) {
      return new Response(JSON.stringify({ error: 'License not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const license = JSON.parse(raw);
    stripeCustomerId = license.stripeCustomerId;
  }

  if (!stripeCustomerId) {
    return new Response(JSON.stringify({ error: 'Email or customerId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const siteUrl = env.SITE_URL || 'https://patapim.ai';
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${siteUrl}/pricing`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
