/**
 * Stripe Checkout Session Creator
 * POST /api/stripe-checkout
 *
 * Body: { plan: 'monthly' | 'annual', email?: string }
 * Returns: { url: string } - Stripe Checkout URL
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': env.SITE_URL || 'https://patapim.ai',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const { plan, email } = body;

    if (!plan || !['monthly', 'annual'].includes(plan)) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan. Must be "monthly" or "annual".' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const priceId = plan === 'monthly'
      ? env.STRIPE_PRICE_ID_MONTHLY
      : env.STRIPE_PRICE_ID_ANNUAL;

    if (!priceId || !env.STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Create Stripe Checkout Session via API
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${env.SITE_URL || 'https://patapim.ai'}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${env.SITE_URL || 'https://patapim.ai'}/pricing?canceled=true`);
    params.append('allow_promotion_codes', 'true');
    params.append('billing_address_collection', 'auto');
    params.append('subscription_data[trial_period_days]', '14');

    if (email) {
      params.append('customer_email', email);
    }

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error('Stripe error:', session);
      return new Response(
        JSON.stringify({ error: 'Failed to create checkout session.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.error('Checkout error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
