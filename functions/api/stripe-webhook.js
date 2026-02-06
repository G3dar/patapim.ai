/**
 * Stripe Webhook Handler
 * POST /api/stripe-webhook
 *
 * Handles: checkout.session.completed, invoice.paid,
 *          customer.subscription.deleted, customer.subscription.updated
 *
 * Stores license data in Cloudflare KV (LICENSES namespace)
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  const body = await request.text();

  // Verify webhook signature
  const isValid = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object, env);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object, env);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, env);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, env);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Generate a license key in PTPM-XXXX-XXXX-XXXX-XXXX format
 */
function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for readability
  const segment = () => {
    let s = '';
    for (let i = 0; i < 4; i++) {
      s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
  };
  return `PTPM-${segment()}-${segment()}-${segment()}-${segment()}`;
}

/**
 * Handle successful checkout: generate license key and store in KV
 */
async function handleCheckoutComplete(session, env) {
  const customerId = session.customer;
  const customerEmail = session.customer_email || session.customer_details?.email;
  const subscriptionId = session.subscription;

  const licenseKey = generateLicenseKey();

  const licenseData = {
    licenseKey,
    customerId,
    customerEmail,
    subscriptionId,
    plan: 'pro',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Store by license key (primary lookup)
  await env.LICENSES.put(`license:${licenseKey}`, JSON.stringify(licenseData));

  // Store by customer email (for user lookup)
  if (customerEmail) {
    await env.LICENSES.put(`email:${customerEmail}`, licenseKey);
  }

  // Store by Stripe customer ID (for webhook lookups)
  await env.LICENSES.put(`stripe:${customerId}`, licenseKey);

  // Store by subscription ID (for subscription events)
  await env.LICENSES.put(`sub:${subscriptionId}`, licenseKey);

  console.log(`License created: ${licenseKey} for ${customerEmail}`);
}

/**
 * Handle invoice paid: extend subscription
 */
async function handleInvoicePaid(invoice, env) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const licenseKey = await env.LICENSES.get(`sub:${subscriptionId}`);
  if (!licenseKey) return;

  const data = await env.LICENSES.get(`license:${licenseKey}`, { type: 'json' });
  if (!data) return;

  data.status = 'active';
  data.updatedAt = new Date().toISOString();
  data.lastPayment = new Date().toISOString();

  await env.LICENSES.put(`license:${licenseKey}`, JSON.stringify(data));
  console.log(`License renewed: ${licenseKey}`);
}

/**
 * Handle subscription deleted: deactivate license
 */
async function handleSubscriptionDeleted(subscription, env) {
  const licenseKey = await env.LICENSES.get(`sub:${subscription.id}`);
  if (!licenseKey) return;

  const data = await env.LICENSES.get(`license:${licenseKey}`, { type: 'json' });
  if (!data) return;

  data.status = 'canceled';
  data.updatedAt = new Date().toISOString();
  data.canceledAt = new Date().toISOString();

  await env.LICENSES.put(`license:${licenseKey}`, JSON.stringify(data));
  console.log(`License canceled: ${licenseKey}`);
}

/**
 * Handle subscription updated: sync status
 */
async function handleSubscriptionUpdated(subscription, env) {
  const licenseKey = await env.LICENSES.get(`sub:${subscription.id}`);
  if (!licenseKey) return;

  const data = await env.LICENSES.get(`license:${licenseKey}`, { type: 'json' });
  if (!data) return;

  const statusMap = {
    active: 'active',
    past_due: 'active', // Grace period
    canceled: 'canceled',
    unpaid: 'expired',
    incomplete: 'pending',
    incomplete_expired: 'expired',
    trialing: 'active',
    paused: 'paused',
  };

  data.status = statusMap[subscription.status] || 'unknown';
  data.updatedAt = new Date().toISOString();

  await env.LICENSES.put(`license:${licenseKey}`, JSON.stringify(data));
  console.log(`License updated: ${licenseKey} -> ${data.status}`);
}

/**
 * Verify Stripe webhook signature (HMAC-SHA256)
 */
async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!secret) return false;

  try {
    const parts = sigHeader.split(',').reduce((acc, part) => {
      const [key, val] = part.split('=');
      acc[key] = val;
      return acc;
    }, {});

    const timestamp = parts.t;
    const signature = parts.v1;

    if (!timestamp || !signature) return false;

    // Check timestamp is within 5 minutes
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const expectedSig = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return expectedSig === signature;
  } catch {
    return false;
  }
}
