import type { APIRoute } from 'astro';
import { getUserFromRequest } from '../../../lib/auth';

export const prerender = false;

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CODE_TTL = 600; // 10 minutes

function generatePairCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const headers = { 'Content-Type': 'application/json' };

  const user = await getUserFromRequest(env.SESSIONS, context.request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const code = generatePairCode();
  await env.SESSIONS.put(`pair:${code}`, JSON.stringify({
    googleId: user.googleId,
    email: user.email,
    createdAt: new Date().toISOString(),
  }), { expirationTtl: CODE_TTL });

  return new Response(JSON.stringify({ code, expiresIn: CODE_TTL }), { status: 200, headers });
};
