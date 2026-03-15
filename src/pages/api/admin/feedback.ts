import type { APIRoute } from 'astro';
import { requireAdmin, listAllKeys, fetchAllValues } from '../../../lib/admin';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  const feedbackKv = env.FEEDBACK;

  const keys = await listAllKeys(feedbackKv, '');
  // Filter out admin-log entries
  const feedbackKeys = keys.filter(k => !k.name.startsWith('admin-log:'));
  const values = await fetchAllValues(feedbackKv, feedbackKeys.map(k => k.name));

  const entries: Array<{
    key: string;
    email: string;
    feedback: string;
    rating: number | null;
    timestamp: string;
  }> = [];

  for (const [key, val] of values) {
    // extend-trial stores feedback as nested object with submittedAt
    const fb = val.feedback;
    const feedbackText = typeof fb === 'object' && fb !== null
      ? [fb.improvements, fb.missingFeatures].filter(Boolean).join(' | ')
      : fb || val.text || val.message || '';
    const rating = typeof fb === 'object' && fb !== null
      ? (fb.recommendScore ?? null)
      : (val.rating ?? null);

    entries.push({
      key,
      email: val.email || '',
      feedback: feedbackText,
      rating,
      timestamp: val.timestamp || val.submittedAt || val.createdAt || '',
    });
  }

  // Sort by timestamp descending
  entries.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  return new Response(JSON.stringify({ feedback: entries, total: entries.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
