import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  // Bearer token auth
  const auth = context.request.headers.get('Authorization');
  const deviceToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!deviceToken) {
    return new Response(JSON.stringify({ valid: false, error: 'Unauthorized' }), { status: 401, headers });
  }

  const raw = await env.LICENSES.get(`device:${deviceToken}`);
  if (!raw) {
    return new Response(JSON.stringify({ valid: false, error: 'Device not found' }), { status: 200, headers });
  }

  const device = JSON.parse(raw);
  const licenseRaw = await env.LICENSES.get(`license:${device.email}`);

  if (!licenseRaw) {
    return new Response(JSON.stringify({
      valid: false,
      email: device.email,
      plan: 'free',
      status: 'no_license',
    }), { status: 200, headers });
  }

  const license = JSON.parse(licenseRaw);
  const validStatuses = ['active', 'trialing'];

  return new Response(JSON.stringify({
    valid: validStatuses.includes(license.status),
    email: device.email,
    plan: license.plan,
    status: license.status,
    licenseKey: license.licenseKey,
    expiresAt: license.expiresAt,
  }), { status: 200, headers });
};
