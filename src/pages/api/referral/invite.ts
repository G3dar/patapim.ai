import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

interface ReferralData {
  email: string;
  referrals: Array<{ email: string; invitedAt: string; activatedAt: string | null }>;
  activatedCount: number;
  rewardGranted: boolean;
  rewardGrantedAt: string | null;
  licenseKey: string | null;
  createdAt: string;
}

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  let body: { email?: string; friendEmail?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const { email, friendEmail } = body;
  if (!email || !friendEmail) {
    return new Response(JSON.stringify({ error: 'email and friendEmail required' }), { status: 400, headers });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || !emailRegex.test(friendEmail)) {
    return new Response(JSON.stringify({ error: 'Invalid email format' }), { status: 400, headers });
  }

  // No self-referral
  if (email.toLowerCase() === friendEmail.toLowerCase()) {
    return new Response(JSON.stringify({ error: 'Cannot refer yourself' }), { status: 400, headers });
  }

  const kv = env.LICENSES;
  const friendLower = friendEmail.toLowerCase();
  const referrerLower = email.toLowerCase();

  // Check if friend was already referred by someone
  const existingReferrer = await kv.get(`referred:${friendLower}`);
  if (existingReferrer) {
    return new Response(JSON.stringify({ error: 'This person was already referred' }), { status: 400, headers });
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
    return new Response(JSON.stringify({ error: 'Maximum invitations reached (20)' }), { status: 400, headers });
  }

  // Check if already invited by this referrer
  if (referralData.referrals.some(r => r.email === friendLower)) {
    return new Response(JSON.stringify({ error: 'Already invited this person' }), { status: 400, headers });
  }

  // Add referral
  referralData.referrals.push({
    email: friendLower,
    invitedAt: now,
    activatedAt: null,
  });

  // Save both keys
  await Promise.all([
    kv.put(`referral:${referrerLower}`, JSON.stringify(referralData)),
    kv.put(`referred:${friendLower}`, referrerLower),
  ]);

  return new Response(JSON.stringify({
    success: true,
    totalInvited: referralData.referrals.length,
    activatedCount: referralData.activatedCount,
  }), { status: 200, headers });
};
