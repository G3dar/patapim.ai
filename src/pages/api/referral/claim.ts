import type { APIRoute } from 'astro';
import { generateLicenseKey } from '../../../lib/license';
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

  const kv = env.LICENSES;
  const emailLower = email.toLowerCase();

  // Check if this email was referred by someone
  const referrerEmail = await kv.get(`referred:${emailLower}`);
  if (!referrerEmail) {
    return new Response(JSON.stringify({ claimed: false, reason: 'Not referred' }), { status: 200, headers });
  }

  // Get referrer's referral data
  const raw = await kv.get(`referral:${referrerEmail}`);
  if (!raw) {
    return new Response(JSON.stringify({ claimed: false, reason: 'Referrer data not found' }), { status: 200, headers });
  }

  const referralData = JSON.parse(raw);
  const now = new Date().toISOString();

  // Find this referral and mark as activated
  const referral = referralData.referrals.find((r: any) => r.email === emailLower);
  if (!referral) {
    return new Response(JSON.stringify({ claimed: false, reason: 'Referral entry not found' }), { status: 200, headers });
  }

  // Already activated
  if (referral.activatedAt) {
    return new Response(JSON.stringify({ claimed: false, reason: 'Already activated' }), { status: 200, headers });
  }

  // Activate
  referral.activatedAt = now;
  referralData.activatedCount = (referralData.activatedCount || 0) + 1;

  // Check if threshold reached (10 activations)
  if (referralData.activatedCount >= 10 && !referralData.rewardGranted) {
    const licenseKey = generateLicenseKey();

    // Create license for the referrer
    const license = {
      email: referrerEmail,
      plan: 'lifetime',
      status: 'active',
      stripeCustomerId: 'referral',
      stripeSubscriptionId: null,
      createdAt: now,
      expiresAt: null,
      licenseKey,
    };

    referralData.rewardGranted = true;
    referralData.rewardGrantedAt = now;
    referralData.licenseKey = licenseKey;

    await Promise.all([
      kv.put(`referral:${referrerEmail}`, JSON.stringify(referralData)),
      kv.put(`license:${referrerEmail}`, JSON.stringify(license)),
      kv.put(`key:${licenseKey}`, referrerEmail),
    ]);
  } else {
    await kv.put(`referral:${referrerEmail}`, JSON.stringify(referralData));
  }

  return new Response(JSON.stringify({
    claimed: true,
    referrerActivatedCount: referralData.activatedCount,
    rewardGranted: referralData.rewardGranted,
  }), { status: 200, headers });
};
