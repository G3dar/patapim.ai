import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../lib/cors';
import { sendBugReportNotification } from '../../lib/email';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);

  let body: { email?: string; description?: string; appVersion?: string; platform?: string };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const { email, description, appVersion, platform } = body;

  if (!description || description.trim().length < 10) {
    return new Response(JSON.stringify({ error: 'Description must be at least 10 characters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const timestamp = new Date().toISOString();
  const randomId = crypto.randomUUID().slice(0, 8);
  const key = `bug:${timestamp}:${randomId}`;

  const value = {
    type: 'bug',
    email: email?.trim() || '',
    description: description.trim(),
    appVersion: appVersion || '',
    platform: platform || '',
    timestamp,
  };

  await env.FEEDBACK.put(key, JSON.stringify(value));

  // Email the bug content to the admin (fire-and-forget; never blocks the response).
  context.locals.runtime.ctx.waitUntil(
    sendBugReportNotification(env, {
      email: value.email,
      description: value.description,
      appVersion: value.appVersion,
      platform: value.platform,
    }).catch((e) => console.error('bug report notify failed', e)),
  );

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
};
