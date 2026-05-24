import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { getUserFromRequest, loadUserByGoogleId } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;

  // SECURITY: require an authenticated session. The Stripe customer is derived
  // from the logged-in user's own records — NEVER from a client-supplied
  // email/customerId. Previously this endpoint had no auth and trusted the body,
  // so anyone could open ANY customer's billing portal just by knowing their
  // email (unauthenticated IDOR -> view invoices/card, cancel subscription).
  const user = await getUserFromRequest(env.SESSIONS, context.request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Resolve the Stripe customer id from the authenticated user's records.
  // Mirrors how /go renders it: license record first, then user record.
  let stripeCustomerId: string | null = null;
  const licenseRaw = await env.LICENSES.get(`license:${user.email}`);
  if (licenseRaw) {
    try {
      stripeCustomerId = JSON.parse(licenseRaw).stripeCustomerId || null;
    } catch {
      /* ignore malformed record */
    }
  }
  if (!stripeCustomerId) {
    const userRec = (await loadUserByGoogleId(env.LICENSES, user.googleId)) as
      | (Record<string, any>)
      | null;
    stripeCustomerId = userRec?.stripeCustomerId || null;
  }

  if (!stripeCustomerId) {
    return new Response(JSON.stringify({ error: 'No billing account found for this user' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const siteUrl = env.SITE_URL || 'https://patapim.ai';
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${siteUrl}/go`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Stripe portal error:', err.message);
    const status = err.statusCode || 500;
    return new Response(JSON.stringify({ error: err.message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
