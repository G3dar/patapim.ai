import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { generateLicenseKey, type License } from '../../../lib/license';
import { createReferralAssociation, activateReferral } from '../../../lib/referral';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  const body = await context.request.text();
  const signature = context.request.headers.get('stripe-signature');

  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const kv = env.LICENSES;

  console.log(`[webhook] Received: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = (
          session.customer_email ||
          session.customer_details?.email ||
          session.client_reference_id ||
          ''
        ).toLowerCase().trim();

        if (!email) {
          console.error('[webhook] checkout.session.completed: no email found', {
            sessionId: session.id,
            customerEmail: session.customer_email,
            customerDetailsEmail: session.customer_details?.email,
            clientReferenceId: session.client_reference_id,
          });
          return new Response(JSON.stringify({ error: 'No customer email' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const customerId = session.customer as string | null;
        const plan = (session.metadata?.plan as 'pro' | 'lifetime') || 'pro';
        const subscriptionId = session.subscription as string | null;

        console.log('[webhook] checkout.session.completed', { email, customerId, plan, mode: session.mode });

        const licenseKey = generateLicenseKey();
        const now = new Date().toISOString();

        const license: License = {
          email,
          plan,
          status: plan === 'pro' ? 'trialing' : 'active',
          stripeCustomerId: customerId || '',
          stripeSubscriptionId: subscriptionId,
          createdAt: now,
          expiresAt: null,
          licenseKey,
        };

        const writes: Promise<void>[] = [
          kv.put(`license:${email}`, JSON.stringify(license)),
          kv.put(`key:${licenseKey}`, email),
        ];
        if (customerId) {
          writes.push(kv.put(`customer:${customerId}`, email));
        }

        // Link purchase to Google account
        const googleId = session.metadata?.googleId || await kv.get(`user-email:${email}`);
        if (googleId) {
          const userRaw = await kv.get(`user:${googleId}`);
          if (userRaw) {
            const userData = JSON.parse(userRaw);
            userData.licenseKey = licenseKey;
            userData.plan = plan;
            userData.stripeCustomerId = customerId || '';
            writes.push(kv.put(`user:${googleId}`, JSON.stringify(userData)));
          }
        }

        await Promise.all(writes);
        console.log('[webhook] License created', { email, licenseKey, plan });

        // Process referral from checkout metadata (Flow B: buyer entered referrer email)
        const referrerEmail = session.metadata?.referrerEmail;
        if (referrerEmail && email) {
          try {
            await createReferralAssociation(kv, referrerEmail, email);
            await activateReferral(kv, email);
          } catch (e) {
            // Best-effort — don't fail the webhook over referral processing
            console.error('[webhook] Referral processing error:', e);
          }
        }

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const email = await kv.get(`customer:${customerId}`);
        if (!email) {
          console.error(`[webhook] subscription.updated: no email for customer ${customerId}`);
          break;
        }

        const raw = await kv.get(`license:${email}`);
        if (!raw) {
          console.error(`[webhook] subscription.updated: no license for ${email}`);
          break;
        }
        const license: License = JSON.parse(raw);

        const statusMap: Record<string, License['status']> = {
          active: 'active',
          trialing: 'trialing',
          past_due: 'past_due',
          canceled: 'canceled',
          unpaid: 'past_due',
        };
        license.status = statusMap[subscription.status] || 'active';

        // Detect pending cancellation (cancel at end of period)
        if (subscription.cancel_at_period_end && license.status === 'active') {
          license.status = 'canceled';
        }

        license.expiresAt = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        await kv.put(`license:${email}`, JSON.stringify(license));
        console.log(`[webhook] subscription.updated: ${email} → ${license.status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const email = await kv.get(`customer:${customerId}`);
        if (!email) {
          console.error(`[webhook] subscription.deleted: no email for customer ${customerId}`);
          break;
        }

        const raw = await kv.get(`license:${email}`);
        if (!raw) {
          console.error(`[webhook] subscription.deleted: no license for ${email}`);
          break;
        }
        const license: License = JSON.parse(raw);

        license.status = 'expired';
        license.expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

        await kv.put(`license:${email}`, JSON.stringify(license));
        console.log(`[webhook] subscription.deleted: ${email} → expired`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const email = await kv.get(`customer:${customerId}`);
        if (!email) {
          console.error(`[webhook] payment_failed: no email for customer ${customerId}`);
          break;
        }

        const raw = await kv.get(`license:${email}`);
        if (!raw) {
          console.error(`[webhook] payment_failed: no license for ${email}`);
          break;
        }
        const license: License = JSON.parse(raw);

        license.status = 'payment_failed';
        await kv.put(`license:${email}`, JSON.stringify(license));
        console.log(`[webhook] payment_failed: ${email}`);
        break;
      }
    }
  } catch (err: any) {
    console.error(`[webhook] Error processing ${event.type}:`, err.message || err);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
