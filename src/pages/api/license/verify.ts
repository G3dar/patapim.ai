import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);

  let body: { email?: string; licenseKey?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ valid: false, reason: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const { email, licenseKey } = body;
  if (!email || !licenseKey) {
    return new Response(JSON.stringify({ valid: false, reason: 'Email and licenseKey required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const kv = env.LICENSES;
  const keyEmail = await kv.get(`key:${licenseKey}`);

  if (!keyEmail) {
    return new Response(JSON.stringify({ valid: false, reason: 'License key not found' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  if (keyEmail !== email) {
    return new Response(JSON.stringify({ valid: false, reason: 'Email does not match' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const raw = await kv.get(`license:${email}`);
  if (!raw) {
    return new Response(JSON.stringify({ valid: false, reason: 'License data not found' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const license = JSON.parse(raw);
  const validStatuses = ['active', 'trialing'];

  if (!validStatuses.includes(license.status)) {
    return new Response(JSON.stringify({
      valid: false,
      reason: `License status: ${license.status}`,
      plan: license.plan,
      status: license.status,
      expiresAt: license.expiresAt,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  return new Response(JSON.stringify({
    valid: true,
    plan: license.plan,
    status: license.status,
    expiresAt: license.expiresAt,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
};
