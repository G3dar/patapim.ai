import type { APIRoute } from 'astro';
import { createSession, buildSessionCookie } from '../../../lib/auth';
import { generateLicenseKey } from '../../../lib/license';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const url = new URL(context.request.url);
  const siteUrl = env.SITE_URL || 'https://patapim.ai';

  // Handle user cancellation
  const error = url.searchParams.get('error');
  if (error) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${siteUrl}/pricing` },
    });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return new Response('Missing code or state', { status: 400 });
  }

  // Validate and consume state (prevent reuse)
  const storedState = await env.SESSIONS.get(`oauth_state:${state}`);
  if (!storedState) {
    return new Response('Invalid or expired state', { status: 400 });
  }
  await env.SESSIONS.delete(`oauth_state:${state}`);

  // Exchange code for tokens
  const redirectUri = `${siteUrl}/api/auth/callback`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return new Response('Token exchange failed', { status: 500 });
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };

  // Fetch user profile
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    return new Response('Failed to fetch user info', { status: 500 });
  }

  const profile = (await userRes.json()) as {
    id: string;
    email: string;
    name: string;
    picture: string;
  };

  // Store/update user in LICENSES KV
  const now = new Date().toISOString();
  const existingRaw = await env.LICENSES.get(`user:${profile.id}`);
  const existing = existingRaw ? JSON.parse(existingRaw) : null;

  const userData = {
    googleId: profile.id,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    createdAt: existing?.createdAt || now,
    lastLogin: now,
  };

  await env.LICENSES.put(`user:${profile.id}`, JSON.stringify(userData));
  await env.LICENSES.put(`user-email:${profile.email}`, profile.id);

  // Create session
  const sessionUser = {
    googleId: profile.id,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
  };
  const sessionId = await createSession(env.SESSIONS, sessionUser);

  // Referral claim: if this user was referred, activate the referral
  try {
    const referrerEmail = await env.LICENSES.get(`referred:${profile.email.toLowerCase()}`);
    if (referrerEmail) {
      const referralRaw = await env.LICENSES.get(`referral:${referrerEmail}`);
      if (referralRaw) {
        const referralData = JSON.parse(referralRaw);
        const referral = referralData.referrals.find((r: any) => r.email === profile.email.toLowerCase());
        if (referral && !referral.activatedAt) {
          referral.activatedAt = now;
          referralData.activatedCount = (referralData.activatedCount || 0) + 1;

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
              env.LICENSES.put(`referral:${referrerEmail}`, JSON.stringify(referralData)),
              env.LICENSES.put(`license:${referrerEmail}`, JSON.stringify(license)),
              env.LICENSES.put(`key:${licenseKey}`, referrerEmail),
            ]);
          } else {
            await env.LICENSES.put(`referral:${referrerEmail}`, JSON.stringify(referralData));
          }
        }
      }
    }
  } catch (e) {
    // Referral claim is best-effort, don't block auth flow
    console.error('Referral claim error:', e);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${siteUrl}/go`,
      'Set-Cookie': buildSessionCookie(sessionId),
    },
  });
};
