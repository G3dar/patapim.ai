import type { APIRoute } from 'astro';
import { generateRefCode } from '../../../lib/referral';
import type { ReferralData } from '../../../lib/referral';
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
  const raw = await kv.get(`referral:${emailLower}`);
  const now = new Date().toISOString();

  let referralData: ReferralData;

  if (raw) {
    referralData = JSON.parse(raw);
    // Already has a code — return it
    if (referralData.refCode) {
      return new Response(JSON.stringify({
        code: referralData.refCode,
        url: `https://patapim.ai/r/${referralData.refCode}`,
      }), { status: 200, headers });
    }
  } else {
    referralData = {
      email: emailLower,
      refCode: null,
      referrals: [],
      activatedCount: 0,
      rewardGranted: false,
      rewardGrantedAt: null,
      licenseKey: null,
      createdAt: now,
    };
  }

  // Generate a unique code with collision check
  let code: string;
  let attempts = 0;
  do {
    code = generateRefCode();
    const existing = await kv.get(`refcode:${code}`);
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  if (attempts >= 10) {
    return new Response(JSON.stringify({ error: 'Failed to generate unique code' }), { status: 500, headers });
  }

  referralData.refCode = code;

  await Promise.all([
    kv.put(`referral:${emailLower}`, JSON.stringify(referralData)),
    kv.put(`refcode:${code}`, emailLower),
  ]);

  return new Response(JSON.stringify({
    code,
    url: `https://patapim.ai/r/${code}`,
  }), { status: 200, headers });
};
