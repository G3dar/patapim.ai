import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  let body: { code?: string; deviceName?: string; machineId?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const { code, deviceName, machineId } = body;
  if (!code || !deviceName || !machineId) {
    return new Response(JSON.stringify({ error: 'code, deviceName, and machineId required' }), { status: 400, headers });
  }

  // Validate and consume the pairing code
  const pairRaw = await env.SESSIONS.get(`pair:${code.toUpperCase()}`);
  if (!pairRaw) {
    return new Response(JSON.stringify({ error: 'Invalid or expired pairing code' }), { status: 400, headers });
  }

  const pairData = JSON.parse(pairRaw);
  await env.SESSIONS.delete(`pair:${code.toUpperCase()}`);

  // Generate device token
  const deviceToken = crypto.randomUUID();
  const now = new Date().toISOString();

  // Store device record
  await env.LICENSES.put(`device:${deviceToken}`, JSON.stringify({
    googleId: pairData.googleId,
    email: pairData.email,
    deviceName,
    machineId,
    createdAt: now,
    lastSeen: now,
    tunnelUrl: null,
    terminalCount: 0,
  }));

  // Append to user's device list
  const devicesRaw = await env.LICENSES.get(`devices:${pairData.googleId}`);
  const devices: Array<{ token: string; deviceName: string; createdAt: string }> = devicesRaw ? JSON.parse(devicesRaw) : [];
  devices.push({ token: deviceToken, deviceName, createdAt: now });
  await env.LICENSES.put(`devices:${pairData.googleId}`, JSON.stringify(devices));

  // Get license info for the device
  const licenseRaw = await env.LICENSES.get(`license:${pairData.email}`);
  const license = licenseRaw ? JSON.parse(licenseRaw) : null;

  return new Response(JSON.stringify({
    deviceToken,
    email: pairData.email,
    license: license ? {
      licenseKey: license.licenseKey,
      plan: license.plan,
      status: license.status,
    } : null,
  }), { status: 200, headers });
};
