import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin';
import { generateLicenseKey, type License } from '../../../lib/license';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  let body: { email: string; googleId: string; plan: 'pro' | 'lifetime' | 'free' };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { email, googleId, plan } = body;
  if (!email || !googleId || !['pro', 'lifetime', 'free'].includes(plan)) {
    return new Response(JSON.stringify({ error: 'Missing or invalid fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const kv = env.LICENSES;
  const now = new Date().toISOString();

  if (plan === 'free') {
    // Downgrade: mark license as expired
    const licenseRaw = await kv.get(`license:${email}`);
    if (licenseRaw) {
      const license: License = JSON.parse(licenseRaw);
      license.status = 'expired';
      await kv.put(`license:${email}`, JSON.stringify(license));
    }

    // Remove plan from user record
    const userRaw = await kv.get(`user:${googleId}`);
    if (userRaw) {
      const userData = JSON.parse(userRaw);
      delete userData.plan;
      delete userData.licenseKey;
      await kv.put(`user:${googleId}`, JSON.stringify(userData));
    }
  } else {
    // Upgrade to pro or lifetime
    const licenseKey = generateLicenseKey();
    const license: License = {
      email,
      plan,
      status: 'active',
      stripeCustomerId: 'admin-grant',
      stripeSubscriptionId: null,
      createdAt: now,
      expiresAt: null,
      licenseKey,
    };

    const writes: Promise<void>[] = [
      kv.put(`license:${email}`, JSON.stringify(license)),
      kv.put(`key:${licenseKey}`, email),
    ];

    // Update user record
    const userRaw = await kv.get(`user:${googleId}`);
    if (userRaw) {
      const userData = JSON.parse(userRaw);
      userData.licenseKey = licenseKey;
      userData.plan = plan;
      userData.stripeCustomerId = 'admin-grant';
      writes.push(kv.put(`user:${googleId}`, JSON.stringify(userData)));
    }

    await Promise.all(writes);
  }

  // Audit log
  await env.FEEDBACK.put(`admin-log:${Date.now()}`, JSON.stringify({
    action: 'plan-change',
    adminEmail: auth.user.email,
    targetEmail: email,
    targetGoogleId: googleId,
    newPlan: plan,
    timestamp: now,
  }));

  return new Response(JSON.stringify({ success: true, plan }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
