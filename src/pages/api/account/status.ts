import type { APIRoute } from 'astro';
import { getUserFromRequest } from '../../../lib/auth';

export const prerender = false;

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.length <= 2
    ? local[0] + '***'
    : local[0] + '***' + local[local.length - 1];
  return `${maskedLocal}@${domain}`;
}

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const headers = { 'Content-Type': 'application/json' };

  const user = await getUserFromRequest(env.SESSIONS, context.request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const [userRaw, licenseRaw, referralRaw, devicesRaw] = await Promise.all([
    env.LICENSES.get(`user:${user.googleId}`),
    env.LICENSES.get(`license:${user.email}`),
    env.LICENSES.get(`referral:${user.email}`),
    env.LICENSES.get(`devices:${user.googleId}`),
  ]);

  const userData = userRaw ? JSON.parse(userRaw) : null;
  const license = licenseRaw ? JSON.parse(licenseRaw) : null;
  const referralData = referralRaw ? JSON.parse(referralRaw) : null;
  const devices = devicesRaw ? JSON.parse(devicesRaw) : [];

  return new Response(JSON.stringify({
    user: {
      googleId: user.googleId,
      email: user.email,
      name: user.name,
      picture: user.picture,
      ...(userData?.plan ? { plan: userData.plan } : {}),
      ...(userData?.licenseKey ? { licenseKey: userData.licenseKey } : {}),
    },
    license,
    referral: referralData ? {
      email: user.email,
      referrals: referralData.referrals.map((r: any) => ({
        email: maskEmail(r.email),
        invitedAt: r.invitedAt,
        activated: !!r.activatedAt,
      })),
      activatedCount: referralData.activatedCount,
      totalInvited: referralData.referrals.length,
      rewardGranted: referralData.rewardGranted,
      rewardGrantedAt: referralData.rewardGrantedAt || null,
      licenseKey: referralData.rewardGranted ? referralData.licenseKey : null,
    } : {
      email: user.email,
      referrals: [],
      activatedCount: 0,
      totalInvited: 0,
      rewardGranted: false,
      licenseKey: null,
    },
    devices,
  }), { status: 200, headers });
};
