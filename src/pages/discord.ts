import type { APIRoute } from 'astro';

export const prerender = false;

const FALLBACK_INVITE = 'https://discord.gg/patapim';

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const stored = await env.LICENSES.get('discord:invite-url');
  const target = stored && /^https:\/\/discord\.gg\/[A-Za-z0-9-]+$/.test(stored) ? stored : FALLBACK_INVITE;
  return Response.redirect(target, 302);
};
