/**
 * Shared referral helpers
 * Used by invite.ts, claim.ts, callback.ts, and webhook.ts
 */

import { generateLicenseKey } from './license';

export interface ReferralData {
  email: string;
  referrals: Array<{ email: string; invitedAt: string; activatedAt: string | null }>;
  activatedCount: number;
  rewardGranted: boolean;
  rewardGrantedAt: string | null;
  licenseKey: string | null;
  createdAt: string;
}

interface AssociationResult {
  created: boolean;
  reason?: string;
}

interface ActivationResult {
  activated: boolean;
  referrerEmail?: string;
  rewardGranted?: boolean;
  reason?: string;
}

/**
 * Create a referral association: referrer → referred
 * Creates/updates KV records for both parties.
 */
export async function createReferralAssociation(
  kv: KVNamespace,
  referrerEmail: string,
  referredEmail: string
): Promise<AssociationResult> {
  const referrerLower = referrerEmail.toLowerCase();
  const referredLower = referredEmail.toLowerCase();

  // No self-referral
  if (referrerLower === referredLower) {
    return { created: false, reason: 'Cannot refer yourself' };
  }

  // Check if already referred by someone
  const existingReferrer = await kv.get(`referred:${referredLower}`);
  if (existingReferrer) {
    return { created: false, reason: 'This person was already referred' };
  }

  // Get or create referral data for this referrer
  const now = new Date().toISOString();
  const raw = await kv.get(`referral:${referrerLower}`);
  let referralData: ReferralData;

  if (raw) {
    referralData = JSON.parse(raw);
  } else {
    referralData = {
      email: referrerLower,
      referrals: [],
      activatedCount: 0,
      rewardGranted: false,
      rewardGrantedAt: null,
      licenseKey: null,
      createdAt: now,
    };
  }

  // Cap at 20 invitations
  if (referralData.referrals.length >= 20) {
    return { created: false, reason: 'Maximum invitations reached (20)' };
  }

  // Check if already invited by this referrer
  if (referralData.referrals.some(r => r.email === referredLower)) {
    return { created: false, reason: 'Already invited this person' };
  }

  // Add referral
  referralData.referrals.push({
    email: referredLower,
    invitedAt: now,
    activatedAt: null,
  });

  // Save both keys
  await Promise.all([
    kv.put(`referral:${referrerLower}`, JSON.stringify(referralData)),
    kv.put(`referred:${referredLower}`, referrerLower),
  ]);

  return { created: true };
}

/**
 * Activate a referral for a referred user.
 * Looks up who referred them, marks activation, and grants reward if threshold met.
 */
export async function activateReferral(
  kv: KVNamespace,
  referredEmail: string
): Promise<ActivationResult> {
  const emailLower = referredEmail.toLowerCase();

  // Check if this email was referred by someone
  const referrerEmail = await kv.get(`referred:${emailLower}`);
  if (!referrerEmail) {
    return { activated: false, reason: 'Not referred' };
  }

  // Get referrer's referral data
  const raw = await kv.get(`referral:${referrerEmail}`);
  if (!raw) {
    return { activated: false, reason: 'Referrer data not found' };
  }

  const referralData: ReferralData = JSON.parse(raw);
  const now = new Date().toISOString();

  // Find this referral entry
  const referral = referralData.referrals.find(r => r.email === emailLower);
  if (!referral) {
    return { activated: false, reason: 'Referral entry not found' };
  }

  // Already activated
  if (referral.activatedAt) {
    return { activated: false, reason: 'Already activated', referrerEmail };
  }

  // Activate
  referral.activatedAt = now;
  referralData.activatedCount = (referralData.activatedCount || 0) + 1;

  // Check if threshold reached (10 activations)
  let rewardGranted = false;
  if (referralData.activatedCount >= 10 && !referralData.rewardGranted) {
    const licenseKey = generateLicenseKey();

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

    rewardGranted = true;
  } else {
    await kv.put(`referral:${referrerEmail}`, JSON.stringify(referralData));
  }

  return { activated: true, referrerEmail, rewardGranted };
}
