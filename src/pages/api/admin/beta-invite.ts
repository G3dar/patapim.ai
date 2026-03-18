import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin';

export const prerender = false;

const BETA_MAX = 50;
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_LEN = 8;
const EXPIRY_DAYS = 7;

function generateBetaCode(): string {
  const arr = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  const kv = env.LICENSES;

  // Check cap
  const generatedRaw = await kv.get('beta:generated');
  const generated = parseInt(generatedRaw || '0', 10) || 0;
  if (generated >= BETA_MAX) {
    return new Response(JSON.stringify({ error: `Beta invite cap reached (${BETA_MAX})` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse body
  let ref = '';
  let note = '';
  try {
    const body = await context.request.json();
    ref = body.ref || '';
    note = body.note || '';
  } catch {
    // empty body is fine
  }

  const code = generateBetaCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const createdAt = now.toISOString();

  const invite = {
    code,
    ref,
    note,
    createdAt,
    expiresAt,
    claimedBy: null as string | null,
    claimedAt: null as string | null,
  };

  // Save invite record
  await kv.put(`beta-invite:${code}`, JSON.stringify(invite));

  // Increment counter
  await kv.put('beta:generated', String(generated + 1));

  // Append to invites list
  const listRaw = await kv.get('beta:invites-list');
  const list: Array<typeof invite> = listRaw ? JSON.parse(listRaw) : [];
  list.push(invite);
  await kv.put('beta:invites-list', JSON.stringify(list));

  const siteUrl = env.SITE_URL || 'https://patapim.ai';

  return new Response(JSON.stringify({
    code,
    url: `${siteUrl}/beta/${code}`,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
