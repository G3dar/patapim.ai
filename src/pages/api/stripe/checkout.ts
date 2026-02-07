import type { APIRoute } from 'astro';
import Stripe from 'stripe';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  let body: { plan?: string; email?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { plan, email } = body;
  if (plan !== 'pro' && plan !== 'lifetime') {
    return new Response(JSON.stringify({ error: 'Invalid plan' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const siteUrl = env.SITE_URL || 'https://patapim.ai';
  const isPro = plan === 'pro';

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: isPro ? 'subscription' : 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price: isPro ? env.STRIPE_PRICE_PRO_MONTHLY : env.STRIPE_PRICE_LIFETIME,
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/download?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/pricing`,
    allow_promotion_codes: true,
    metadata: { plan },
  };

  if (email) {
    sessionParams.customer_email = email;
    sessionParams.client_reference_id = email;

    // Link purchase to Google account if user is signed in
    const googleId = await env.LICENSES.get(`user-email:${email}`);
    if (googleId) {
      sessionParams.metadata!.googleId = googleId;
    }
  }

  if (isPro) {
    sessionParams.subscription_data = { trial_period_days: 14 };
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);
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
