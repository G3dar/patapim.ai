import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

/**
 * GET /api/device/ollama-config
 * Returns the Ollama server configuration for the user owning this device token.
 * Used by PATAPIM desktop app (and ollama-monitor) to pull cloud-centralized config.
 */
export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  const auth = context.request.headers.get('Authorization');
  const deviceToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!deviceToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const deviceRaw = await env.LICENSES.get(`device:${deviceToken}`);
  if (!deviceRaw) {
    return new Response(JSON.stringify({ error: 'Device not found' }), { status: 404, headers });
  }

  const device = JSON.parse(deviceRaw);
  const googleId = device.googleId;
  if (!googleId) {
    return new Response(JSON.stringify({ error: 'No Google account linked' }), { status: 400, headers });
  }

  const cfgRaw = await env.LICENSES.get(`ollamaConfig:${googleId}`);
  if (!cfgRaw) {
    return new Response(JSON.stringify({ error: 'Not configured' }), { status: 404, headers });
  }

  return new Response(cfgRaw, { status: 200, headers });
};
