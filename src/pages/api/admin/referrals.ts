import type { APIRoute } from 'astro';
import { requireAdmin, listAllKeys, fetchAllValues } from '../../../lib/admin';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  const kv = env.LICENSES;

  const referralKeys = await listAllKeys(kv, 'referral:');
  const referralValues = await fetchAllValues(kv, referralKeys.map(k => k.name));

  let totalInvitations = 0;
  let totalActivations = 0;
  let totalRewards = 0;

  type ReferrerEntry = {
    email: string;
    invited: number;
    activated: number;
    conversionRate: number;
    rewardGranted: boolean;
    rewardGrantedAt: string | null;
    referrals: Array<{ email: string; invitedAt: string; activatedAt: string | null }>;
  };

  const referrers: ReferrerEntry[] = [];

  for (const [, r] of referralValues) {
    const invited = r.referrals?.length || 0;
    const activated = r.activatedCount || 0;
    totalInvitations += invited;
    totalActivations += activated;
    if (r.rewardGranted) totalRewards++;

    referrers.push({
      email: r.email,
      invited,
      activated,
      conversionRate: invited > 0 ? +((activated / invited) * 100).toFixed(1) : 0,
      rewardGranted: !!r.rewardGranted,
      rewardGrantedAt: r.rewardGrantedAt || null,
      referrals: r.referrals || [],
    });
  }

  // Sort by activated count descending
  referrers.sort((a, b) => b.activated - a.activated);

  return new Response(JSON.stringify({
    summary: {
      totalReferrers: referrers.length,
      totalInvitations,
      totalActivations,
      conversionRate: totalInvitations > 0 ? +((totalActivations / totalInvitations) * 100).toFixed(1) : 0,
      totalRewards,
    },
    referrers,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
