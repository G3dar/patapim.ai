/**
 * Shared license utilities
 * Used by Stripe webhook and referral system
 */

export interface License {
  email: string;
  plan: 'pro' | 'lifetime';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired' | 'payment_failed';
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  createdAt: string;
  expiresAt: string | null;
  licenseKey: string;
}

export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segments = [];
  for (let s = 0; s < 3; s++) {
    let seg = '';
    for (let i = 0; i < 4; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(seg);
  }
  return 'PTPM-' + segments.join('-');
}
