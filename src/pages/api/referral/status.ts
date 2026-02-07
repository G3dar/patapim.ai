import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.length <= 2
    ? local[0] + '***'
    : local[0] + '***' + local[local.length - 1];
  return `${maskedLocal}@${domain}`;
}

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

  if (!raw) {
    return new Response(JSON.stringify({
      email: emailLower,
      referrals: [],
      activatedCount: 0,
      totalInvited: 0,
      rewardGranted: false,
      licenseKey: null,
    }), { status: 200, headers });
  }

  const data = JSON.parse(raw);

  return new Response(JSON.stringify({
    email: emailLower,
    referrals: data.referrals.map((r: any) => ({
      email: maskEmail(r.email),
      invitedAt: r.invitedAt,
      activated: !!r.activatedAt,
    })),
    activatedCount: data.activatedCount,
    totalInvited: data.referrals.length,
    rewardGranted: data.rewardGranted,
    rewardGrantedAt: data.rewardGrantedAt || null,
    licenseKey: data.rewardGranted ? data.licenseKey : null,
  }), { status: 200, headers });
};
