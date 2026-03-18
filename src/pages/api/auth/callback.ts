import type { APIRoute } from 'astro';
import { createSession, buildSessionCookie } from '../../../lib/auth';
import { activateReferral, createReferralAssociation } from '../../../lib/referral';
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

  // Extract beta code from OAuth state if present
  let betaCodeFromState = '';
  if (storedState !== 'true') {
    try {
      const stateData = JSON.parse(storedState);
      betaCodeFromState = stateData.beta || '';
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

  // Track new signups (only for first-time users)
  if (!existing) {
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
  const sessionUser = {
    googleId: profile.id,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
  };
  const sessionId = await createSession(env.SESSIONS, sessionUser);

  // Auto-pairing: if desktop app initiated this flow, create device token automatically
  const cookies = context.request.headers.get('cookie') || '';

  // Referral: read cookie-based referral and create association, then activate
  try {
    const refCookieMatch = cookies.match(/(?:^|;\s*)__patapim_ref=([^;]+)/);
    if (refCookieMatch) {
      const referrerEmail = decodeURIComponent(refCookieMatch[1]);
      await createReferralAssociation(env.LICENSES, referrerEmail, profile.email);
    }
    await activateReferral(env.LICENSES, profile.email);
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
          // Check user doesn't already have an active license
          const existingLicenseRaw = await env.LICENSES.get(`license:${profile.email}`);
          const existingLicense = existingLicenseRaw ? JSON.parse(existingLicenseRaw) : null;

          if (!existingLicense || existingLicense.status !== 'active') {
            // Generate license (same pattern as Stripe webhook / referral reward)
            const licenseKey = generateLicenseKey();
            const license = {
              email: profile.email,
              plan: 'lifetime',
              status: 'active',
              stripeCustomerId: 'beta-invite',
              stripeSubscriptionId: null,
              createdAt: now,
              expiresAt: null,
              licenseKey,
            };

            // Mark invite as claimed
            invite.claimedBy = profile.email;
            invite.claimedAt = now;

            // Save all records in parallel
            await Promise.all([
              env.LICENSES.put(`license:${profile.email}`, JSON.stringify(license)),
              env.LICENSES.put(`key:${licenseKey}`, profile.email),
              env.LICENSES.put(`beta-invite:${betaCode}`, JSON.stringify(invite)),
              env.LICENSES.put(`beta-grant:${profile.email}`, JSON.stringify({
                code: betaCode,
                ref: invite.ref || '',
                grantedAt: now,
                licenseKey,
              })),
            ]);

            // Increment claimed counter
            const claimedRaw = await env.LICENSES.get('beta:claimed');
            await env.LICENSES.put('beta:claimed', String((parseInt(claimedRaw || '0', 10) || 0) + 1));

            // Update invites list with claimed status
            try {
              const listRaw = await env.LICENSES.get('beta:invites-list');
              if (listRaw) {
                const list = JSON.parse(listRaw);
                const entry = list.find((e: any) => e.code === betaCode);
                if (entry) {
                  entry.claimedBy = profile.email;
                  entry.claimedAt = now;
                  await env.LICENSES.put('beta:invites-list', JSON.stringify(list));
                }
              }
            } catch {
              // Best-effort list update
            }

            // Build response: redirect to beta success page
            const betaHeaders = new Headers();
            betaHeaders.append('Set-Cookie', buildSessionCookie(sessionId));
            betaHeaders.append('Set-Cookie', '__patapim_ref=; Secure; SameSite=Lax; Path=/; Max-Age=0');
            betaHeaders.append('Set-Cookie', '__patapim_beta=; Secure; SameSite=Lax; Path=/; Max-Age=0');
            betaHeaders.set('Location', `${siteUrl}/beta/success`);
            return new Response(null, { status: 302, headers: betaHeaders });
          }
        }
      }
    } catch (e) {
      console.error('Beta invite claim error:', e);
    }
  }

  const pairMatch = cookies.match(/(?:^|;\s*)__patapim_pair=([^;]+)/);
  const pairingSessionId = pairMatch ? pairMatch[1] : null;

  const responseHeaders = new Headers();
  responseHeaders.append('Set-Cookie', buildSessionCookie(sessionId));
  // Clear referral cookie after processing
  responseHeaders.append('Set-Cookie', '__patapim_ref=; Secure; SameSite=Lax; Path=/; Max-Age=0');
  // Clear beta cookie after processing
  responseHeaders.append('Set-Cookie', '__patapim_beta=; Secure; SameSite=Lax; Path=/; Max-Age=0');

  if (pairingSessionId) {
    // Auto-create device token for the desktop app
    const deviceToken = crypto.randomUUID();

    await env.LICENSES.put(`device:${deviceToken}`, JSON.stringify({
      googleId: profile.id,
      email: profile.email,
      deviceName: 'PATAPIM Desktop',
      machineId: 'auto-pair',
      createdAt: now,
      lastSeen: now,
      tunnelUrl: null,
      terminalCount: 0,
    }));

    // Append to user's device list
    const devicesRaw = await env.LICENSES.get(`devices:${profile.id}`);
    const devices: Array<{ token: string; deviceName: string; createdAt: string }> = devicesRaw ? JSON.parse(devicesRaw) : [];
    devices.push({ token: deviceToken, deviceName: 'PATAPIM Desktop', createdAt: now });
    await env.LICENSES.put(`devices:${profile.id}`, JSON.stringify(devices));

    // Get license info
    const licenseRaw = await env.LICENSES.get(`license:${profile.email}`);
    const license = licenseRaw ? JSON.parse(licenseRaw) : null;

    // Store result for desktop polling
    await env.SESSIONS.put(`pair-poll:${pairingSessionId}`, JSON.stringify({
      deviceToken,
      email: profile.email,
      plan: license?.plan || 'free',
      licenseStatus: license?.status || null,
      licenseKey: license?.licenseKey || null,
    }), { expirationTtl: 600 });

    // Clear the pairing cookie
    responseHeaders.append('Set-Cookie', '__patapim_pair=; Secure; SameSite=Lax; Path=/; Max-Age=0');
  }

  responseHeaders.set('Location', `${siteUrl}/go${pairingSessionId ? '?paired=1' : ''}`);
  return new Response(null, { status: 302, headers: responseHeaders });
};
