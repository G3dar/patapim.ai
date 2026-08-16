import { defineMiddleware } from 'astro:middleware';
import { parseCookie } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  // Detect locale from URL path
  const url = new URL(context.request.url);
  const locale = url.pathname.startsWith('/ja/') || url.pathname === '/ja' ? 'ja' : 'en';
  (context.locals as any).locale = locale;

  const response = await next();

  // Only count page views for HTML pages (not API, not assets)
  const path = url.pathname;

  if (
    path.startsWith('/api/') ||
    path.startsWith('/_') ||
    path.includes('.') ||
    context.request.method !== 'GET'
  ) {
    return response;
  }

  // Only count if response is HTML
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) {
    return response;
  }

  // Increment page view + referrer counters. Genuinely non-blocking now: the
  // whole KV read-modify-write chain (pageviews + referrers + the O(users)
  // DAU blob) used to be AWAITED before returning, adding ~0.3-1s of TTFB to
  // EVERY signed-in HTML page view. ctx.waitUntil runs it after the response
  // is on the wire; the counters were always best-effort/racy anyway.
  try {
    const runtimeCtx = (context.locals as any).runtime?.ctx;
    const env = context.locals.runtime.env;
    const request = context.request;
    const analytics = (async () => {
      try {
        const kv = env.LICENSES;
        const today = new Date().toISOString().slice(0, 10);

        // Extract referrer domain (skip self-referrals and empty)
        const refHeader = request.headers.get('referer') || '';
        let refDomain = '';
        try {
          if (refHeader) {
            const refUrl = new URL(refHeader);
            const host = refUrl.hostname.replace(/^www\./, '');
            if (host !== 'patapim.ai') refDomain = host;
          }
        } catch {}

        const sessionId = parseCookie(request);

        const reads: Promise<string | null>[] = [kv.get(`stats:pageviews:${today}`)];
        if (refDomain) reads.push(kv.get(`stats:referrers:${today}`));
        const [pvRaw, refRaw] = await Promise.all(reads);

        const puts: Promise<void>[] = [
          kv.put(`stats:pageviews:${today}`, String((parseInt(pvRaw || '0', 10) || 0) + 1)),
        ];

        if (refDomain) {
          const referrers = refRaw ? JSON.parse(refRaw) : {};
          referrers[refDomain] = (referrers[refDomain] || 0) + 1;
          puts.push(kv.put(`stats:referrers:${today}`, JSON.stringify(referrers)));
        }

        // DAU tracking
        if (sessionId) {
          const sessions = env.SESSIONS;
          const userRaw = await sessions.get(sessionId);
          if (userRaw) {
            try {
              const userData = JSON.parse(userRaw);
              if (userData.email) {
                const dauKey = `stats:dau:${today}`;
                const dauRaw = await kv.get(dauKey);
                const dau: Record<string, boolean> = dauRaw ? JSON.parse(dauRaw) : {};
                if (!dau[userData.email]) {
                  dau[userData.email] = true;
                  puts.push(kv.put(dauKey, JSON.stringify(dau)));
                }
              }
            } catch {}
          }
        }

        await Promise.all(puts);
      } catch {}
    })();
    if (runtimeCtx && typeof runtimeCtx.waitUntil === 'function') {
      runtimeCtx.waitUntil(analytics);
    } else {
      await analytics; // local dev / astro preview — no worker ctx
    }
  } catch {}

  return response;
});
