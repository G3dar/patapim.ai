import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin';

export const prerender = false;

const INVITE_RE = /^https:\/\/discord\.gg\/[A-Za-z0-9-]+$/;

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  const url = await env.LICENSES.get('discord:invite-url');
  const updatedAt = await env.LICENSES.get('discord:invite-updated-at');

  return new Response(JSON.stringify({ url: url || '', updatedAt: updatedAt || null }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  let body: { url?: string } = {};
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = (body.url || '').trim();
  if (!INVITE_RE.test(url)) {
    return new Response(JSON.stringify({ error: 'URL must look like https://discord.gg/CODE' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updatedAt = new Date().toISOString();
  await env.LICENSES.put('discord:invite-url', url);
  await env.LICENSES.put('discord:invite-updated-at', updatedAt);

  return new Response(JSON.stringify({ ok: true, url, updatedAt }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
