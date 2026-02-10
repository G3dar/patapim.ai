import type { APIRoute } from 'astro';
import { requireAdmin, listAllKeys, fetchAllValues } from '../../../lib/admin';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  const feedbackKv = env.FEEDBACK;

  const keys = await listAllKeys(feedbackKv, 'bug:');
  const values = await fetchAllValues(feedbackKv, keys.map(k => k.name));

  const bugs: Array<{
    key: string;
    email: string;
    description: string;
    appVersion: string;
    platform: string;
    timestamp: string;
  }> = [];

  for (const [key, val] of values) {
    bugs.push({
      key,
      email: val.email || '',
      description: val.description || '',
      appVersion: val.appVersion || '',
      platform: val.platform || '',
      timestamp: val.timestamp || '',
    });
  }

  // Sort by timestamp descending (newest first)
  bugs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  return new Response(JSON.stringify({ bugs, total: bugs.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
