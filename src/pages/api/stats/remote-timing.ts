import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Boot-timing beacon from /remotedesk (navigator.sendBeacon on frame load).
 * Appends {ts, marks} to a small daily KV ring so before/after comparisons of
 * the remote-connect waterfall are measurable from real phones. Fire-and-
 * forget: the write happens in waitUntil, the beacon gets an instant 204.
 */
export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.text();
    if (body && body.length < 2048) {
      const env = context.locals.runtime.env;
      const ctx = (context.locals as any).runtime?.ctx;
      const write = (async () => {
        try {
          const marks = JSON.parse(body);
          const day = new Date().toISOString().slice(0, 10);
          const key = `stats:remote-timing:${day}`;
          const raw = await env.LICENSES.get(key);
          const entries: unknown[] = raw ? JSON.parse(raw) : [];
          entries.push({ ts: new Date().toISOString(), marks });
          // Keep the ring small — this is a diagnostic, not analytics.
          while (entries.length > 200) entries.shift();
          await env.LICENSES.put(key, JSON.stringify(entries), { expirationTtl: 14 * 24 * 3600 });
        } catch { /* malformed beacon — drop */ }
      })();
      if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(write);
    }
  } catch { /* never fail a beacon */ }
  return new Response(null, { status: 204 });
};
