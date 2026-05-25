import type { APIRoute } from 'astro';
import {
  createSession,
  buildSessionCookie,
  loadUserById,
  loadUserByEmail,
  loadUserByGoogleId,
  saveUser,
  normalizeEmail,
  type UserRecord,
} from '../../../lib/auth';
import { activateReferral, createReferralAssociation } from '../../../lib/referral';
import { generateLicenseKey } from '../../../lib/license';
import { completePairingIfPresent } from '../../../lib/pairing';

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

  // SECURITY (N-3): the state must match the HttpOnly cookie set when THIS
  // browser started the flow (auth/google). Defeats login-CSRF / session
  // fixation where an attacker tricks a victim into completing the attacker's
  // OAuth flow (which would log the victim into the attacker's account).
  const stateCookie = (
    (context.request.headers.get('cookie') || '').match(
      /(?:^|;\s*)__patapim_oauth_state=([^;]+)/,
    ) || []
  )[1] || '';
  if (!stateCookie || stateCookie !== state) {
    return new Response('Invalid state (no matching browser session)', { status: 400 });
  }

  // Validate and consume state (prevent reuse)
  const storedState = await env.SESSIONS.get(`oauth_state:${state}`);
  if (!storedState) {
    return new Response('Invalid or expired state', { status: 400 });
  }
  await env.SESSIONS.delete(`oauth_state:${state}`);

  // Extract beta code and returnTo from OAuth state if present
  let betaCodeFromState = '';
  let returnToFromState = '';
  if (storedState !== 'true') {
    try {
      const stateData = JSON.parse(storedState);
      betaCodeFromState = stateData.beta || '';
      returnToFromState = stateData.returnTo || '';
    } catch {
      // Not JSON — ignore
    }
  }

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

  const now = new Date().toISOString();
  const profileEmail = normalizeEmail(profile.email);

  // Auto-link / lazy migration. Order matters:
  //   1. user-google index (newly-linked or already-migrated)
  //   2. legacy user:{googleId} (pre-migration Google users)
  //   3. user-email (password-only user signing in with Google for the first
  //      time — link the two accounts)
  //   4. brand new
  let user = await loadUserByGoogleId(env.LICENSES, profile.id);
  let isNew = false;

  if (!user) {
    const byEmail = await loadUserByEmail(env.LICENSES, profileEmail);
    if (byEmail) {
      // Existing email-only or partially-set-up account — link Google to it.
      user = byEmail;
      user.linkedGoogleId = profile.id;
      // Google sign-in proves email control.
      if (!user.emailVerified) {
        user.emailVerified = true;
        user.emailVerifiedAt = now;
      }
    } else {
      // First sign-in for this Google account, no matching email — fresh user.
      // Use the Google sub as the primary id (legacy-compatible shape).
      user = {
        googleId: profile.id,
        email: profileEmail,
        name: profile.name,
        picture: profile.picture,
        createdAt: now,
        lastLogin: now,
        emailVerified: true,
        emailVerifiedAt: now,
      };
      isNew = true;
    }
  }

  // Refresh fields that Google is authoritative for.
  user.name = profile.name || user.name;
  user.picture = profile.picture || user.picture;
  user.lastLogin = now;
  if (!user.emailVerified) {
    user.emailVerified = true;
    user.emailVerifiedAt = now;
  }

  await saveUser(env.LICENSES, user);

  // Track new signups (only for first-time Google users with no prior account)
  if (isNew) {
    const today = new Date().toISOString().slice(0, 10);
    context.locals.runtime.ctx.waitUntil((async () => {
      try {
        const raw = await env.LICENSES.get(`stats:signups:${today}`);
        await env.LICENSES.put(`stats:signups:${today}`, String((parseInt(raw || '0', 10) || 0) + 1));
      } catch {
        // Best-effort counter
      }
    })());
  }

  // Create session
  const sessionId = await createSession(env.SESSIONS, {
    googleId: user.googleId,
    email: user.email,
    name: user.name,
    picture: user.picture,
  });

  const cookies = context.request.headers.get('cookie') || '';

  // Referral: read cookie-based referral and create association, then activate
  try {
    const refCookieMatch = cookies.match(/(?:^|;\s*)__patapim_ref=([^;]+)/);
    if (refCookieMatch) {
      const referrerEmail = decodeURIComponent(refCookieMatch[1]);
      await createReferralAssociation(env.LICENSES, referrerEmail, user.email);
    }
    await activateReferral(env.LICENSES, user.email);
  } catch (e) {
    console.error('Referral claim error:', e);
  }

  // Beta invite: check state or cookie for beta code
  const betaCookieMatch = cookies.match(/(?:^|;\s*)__patapim_beta=([^;]+)/);
  const betaCode = betaCodeFromState || (betaCookieMatch ? betaCookieMatch[1] : '');

  if (betaCode) {
    try {
      const inviteRaw = await env.LICENSES.get(`beta-invite:${betaCode}`);
      if (inviteRaw) {
        const invite = JSON.parse(inviteRaw);
        const isValid = !invite.claimedBy && new Date(invite.expiresAt) > new Date();

        if (isValid) {
          const existingLicenseRaw = await env.LICENSES.get(`license:${user.email}`);
          const existingLicense = existingLicenseRaw ? JSON.parse(existingLicenseRaw) : null;

          if (!existingLicense || existingLicense.status !== 'active') {
            const licenseKey = generateLicenseKey();
            const license = {
              email: user.email,
              plan: 'lifetime',
              status: 'active',
              stripeCustomerId: 'beta-invite',
              stripeSubscriptionId: null,
              createdAt: now,
              expiresAt: null,
              licenseKey,
            };

            invite.claimedBy = user.email;
            invite.claimedAt = now;

            await Promise.all([
              env.LICENSES.put(`license:${user.email}`, JSON.stringify(license)),
              env.LICENSES.put(`key:${licenseKey}`, user.email),
              env.LICENSES.put(`beta-invite:${betaCode}`, JSON.stringify(invite)),
              env.LICENSES.put(`beta-grant:${user.email}`, JSON.stringify({
                code: betaCode,
                ref: invite.ref || '',
                grantedAt: now,
                licenseKey,
              })),
            ]);

            const claimedRaw = await env.LICENSES.get('beta:claimed');
            await env.LICENSES.put('beta:claimed', String((parseInt(claimedRaw || '0', 10) || 0) + 1));

            try {
              const listRaw = await env.LICENSES.get('beta:invites-list');
              if (listRaw) {
                const list = JSON.parse(listRaw);
                const entry = list.find((e: any) => e.code === betaCode);
                if (entry) {
                  entry.claimedBy = user.email;
                  entry.claimedAt = now;
                  await env.LICENSES.put('beta:invites-list', JSON.stringify(list));
                }
              }
            } catch {
              // Best-effort list update
            }

            const betaHeaders = new Headers();
            betaHeaders.append('Set-Cookie', buildSessionCookie(sessionId));
            betaHeaders.append('Set-Cookie', '__patapim_ref=; Secure; SameSite=Lax; Path=/; Max-Age=0');
            betaHeaders.append('Set-Cookie', '__patapim_beta=; Secure; SameSite=Lax; Path=/; Max-Age=0');
            betaHeaders.append('Set-Cookie', '__patapim_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
            betaHeaders.set('Location', `${siteUrl}/beta/success`);
            return new Response(null, { status: 302, headers: betaHeaders });
          }
        }
      }
    } catch (e) {
      console.error('Beta invite claim error:', e);
    }
  }

  // Desktop pairing handoff (if a __patapim_pair cookie was set by /signin)
  const pairClearCookie = await completePairingIfPresent(env, context.request, {
    googleId: user.googleId,
    email: user.email,
  });

  const responseHeaders = new Headers();
  responseHeaders.append('Set-Cookie', buildSessionCookie(sessionId));
  responseHeaders.append('Set-Cookie', '__patapim_ref=; Secure; SameSite=Lax; Path=/; Max-Age=0');
  responseHeaders.append('Set-Cookie', '__patapim_beta=; Secure; SameSite=Lax; Path=/; Max-Age=0');
  responseHeaders.append('Set-Cookie', '__patapim_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
  if (pairClearCookie) {
    responseHeaders.append('Set-Cookie', pairClearCookie);
  }

  // Redirect: preserve returnTo from native app, or default to /go
  let finalRedirect = `${siteUrl}/go${pairClearCookie ? '?paired=1' : ''}`;
  if (returnToFromState && !pairClearCookie) {
    if (returnToFromState.startsWith('/')) {
      finalRedirect = `${siteUrl}${returnToFromState}`;
    }
  }
  responseHeaders.set('Location', finalRedirect);
  return new Response(null, { status: 302, headers: responseHeaders });
};

// Suppress unused-import warning (kept for potential future use)
void loadUserById;
