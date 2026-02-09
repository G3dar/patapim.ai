import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  let body: { sessionId?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const { sessionId } = body;
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'sessionId required' }), { status: 400, headers });
  }

  const raw = await env.SESSIONS.get(`pair-poll:${sessionId}`);
  if (!raw) {
    // Not ready yet — desktop should keep polling
    return new Response(JSON.stringify({ status: 'pending' }), { status: 200, headers });
  }

  const data = JSON.parse(raw);

  // Consume the result so it can't be polled again
  await env.SESSIONS.delete(`pair-poll:${sessionId}`);

  return new Response(JSON.stringify({
    status: 'ready',
    deviceToken: data.deviceToken,
    email: data.email,
    plan: data.plan,
    licenseStatus: data.licenseStatus,
    licenseKey: data.licenseKey,
  }), { status: 200, headers });
};
