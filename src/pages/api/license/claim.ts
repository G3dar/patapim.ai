import type { APIRoute } from 'astro';
import { assertSameOrigin, getUserFromRequest, normalizeEmail } from '../../../lib/auth';
import { rateLimit, clientIp, tooManyRequests } from '../../../lib/rateLimit';

export const prerender = false;

interface RequestBody {
  licenseKey?: string;
}

const MAX_ACCOUNTS_PER_KEY = 2;

function jsonError(error: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/license/claim
//
// Associates the caller's authenticated account with an existing license key.
// Up to MAX_ACCOUNTS_PER_KEY (2) accounts can share a single key — useful when
// a customer paid via Stripe with one email but uses PATAPIM with another, or
// when they want to share a lifetime license with a partner / second device.
//
// Behavior:
//  - already-associated email => no-op success
//  - new email + slot available => associate, return success
//  - new email + slots full => 409 max_accounts_reached
//
// This is additive — it does not transfer or revoke any existing association.

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const siteUrl = env.SITE_URL || 'https://patapim.ai';

  if (!assertSameOrigin(context.request, siteUrl)) return jsonError('forbidden', 403);

  const session = await getUserFromRequest(env.SESSIONS, context.request);
  if (!session) return jsonError('unauthenticated', 401);

  const ip = clientIp(context.request);
  const ipLimit = await rateLimit(env.SESSIONS, `claim:ip:${ip}`, { limit: 10, windowSeconds: 3600 });
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter);

  let body: RequestBody;
  try {
    body = (await context.request.json()) as RequestBody;
  } catch {
    return jsonError('invalid_body');
  }

  const licenseKey = typeof body.licenseKey === 'string' ? body.licenseKey.trim() : '';
  if (!licenseKey) return jsonError('invalid_license_key');

  const userEmail = normalizeEmail(session.email);
  const kv = env.LICENSES;

  // Look up the key — must exist (created by Stripe webhook, beta grant, or
  // admin). The reverse-lookup value is the original/primary owner email.
  const ownerEmail = await kv.get(`key:${licenseKey}`);
  if (!ownerEmail) return jsonError('license_not_found', 404);

  // Load the source-of-truth license record from the primary owner.
  const sourceRaw = await kv.get(`license:${ownerEmail}`);
  if (!sourceRaw) return jsonError('license_data_missing', 404);

  const sourceLicense = JSON.parse(sourceRaw);
  if (sourceLicense.licenseKey !== licenseKey) return jsonError('license_mismatch', 400);

  // Status guard.
  const validStatuses = ['active', 'trialing'];
  const isCanceledButActive = sourceLicense.status === 'canceled'
    && sourceLicense.expiresAt && new Date(sourceLicense.expiresAt) > new Date();
  if (!validStatuses.includes(sourceLicense.status) && !isCanceledButActive) {
    return jsonError('license_inactive', 400, { status: sourceLicense.status });
  }

  // Read the associated-emails list. Initialize lazily from the primary owner
  // so legacy single-owner keys keep working without a migration job.
  const listKey = `license-emails:${licenseKey}`;
  const listRaw = await kv.get(listKey);
  let associatedEmails: string[] = [];
  if (listRaw) {
    try {
      const parsed = JSON.parse(listRaw);
      if (Array.isArray(parsed)) associatedEmails = parsed.filter((s) => typeof s === 'string');
    } catch {
      // fall through with empty list — we'll rebuild from the owner below
    }
  }
  if (associatedEmails.length === 0) {
    associatedEmails = [normalizeEmail(ownerEmail)];
  }

  // Already associated — no-op success.
  if (associatedEmails.includes(userEmail)) {
    return new Response(JSON.stringify({
      ok: true,
      alreadyAssociated: true,
      plan: sourceLicense.plan,
      status: sourceLicense.status,
      associatedEmails,
      remainingSlots: Math.max(0, MAX_ACCOUNTS_PER_KEY - associatedEmails.length),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // No more slots.
  if (associatedEmails.length >= MAX_ACCOUNTS_PER_KEY) {
    return jsonError('max_accounts_reached', 409, {
      max: MAX_ACCOUNTS_PER_KEY,
      associatedCount: associatedEmails.length,
    });
  }

  // Add this account: write the per-account license copy, update reverse
  // index for fast lookup, append to the shared list.
  associatedEmails.push(userEmail);

  const userLicense = {
    ...sourceLicense,
    email: userEmail,
    sharedWith: associatedEmails.filter((e) => e !== userEmail),
    associatedAt: new Date().toISOString(),
    primaryEmail: ownerEmail,
  };

  await Promise.all([
    kv.put(`license:${userEmail}`, JSON.stringify(userLicense)),
    kv.put(listKey, JSON.stringify(associatedEmails)),
  ]);

  // Patch the user record so /go's plan computation sees the new license on
  // the very next read (it falls back to user.plan when no license:{email}).
  const userKv = await kv.get(`user-email:${userEmail}`);
  if (userKv) {
    const userId = userKv;
    const userRaw = await kv.get(`user:${userId}`);
    if (userRaw) {
      const u = JSON.parse(userRaw);
      u.licenseKey = licenseKey;
      u.plan = sourceLicense.plan;
      await kv.put(`user:${userId}`, JSON.stringify(u));
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    alreadyAssociated: false,
    plan: sourceLicense.plan,
    status: sourceLicense.status,
    associatedEmails,
    remainingSlots: Math.max(0, MAX_ACCOUNTS_PER_KEY - associatedEmails.length),
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
