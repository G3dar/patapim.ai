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

    // SECURITY: a Stripe checkout-session id is a capability that can leak
    // (browser history, Referer header). Only hand back the licenseKey for a
    // freshly-completed purchase — the success page calls this within seconds.
    // On later replay we still return status/plan but withhold the key (the
    // buyer can retrieve it by signing in / redeeming). Closes the indefinite
    // "got a cs_ id -> harvest license key" leak that fed license/redeem theft.
    const ageSeconds = Math.floor(Date.now() / 1000) - (session.created || 0);
    const fresh = ageSeconds < 3600 && session.payment_status !== 'unpaid';

    return new Response(JSON.stringify({
      found: true,
      email,
      licenseKey: fresh ? license.licenseKey : null,
      plan: license.plan,
      status: license.status,
      ...(fresh ? {} : { keyWithheld: true }),
    }), { status: 200, headers });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
