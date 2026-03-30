import { defineMiddleware } from 'astro:middleware';

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

  // Increment page view + referrer counters (best-effort, non-blocking)
  try {
    const env = context.locals.runtime.env;
    const kv = env.LICENSES;
    const today = new Date().toISOString().slice(0, 10);

    // Extract referrer domain (skip self-referrals and empty)
    const refHeader = context.request.headers.get('referer') || '';
    let refDomain = '';
    try {
      if (refHeader) {
        const refUrl = new URL(refHeader);
        const host = refUrl.hostname.replace(/^www\./, '');
        if (host !== 'patapim.ai') refDomain = host;
      }
    } catch {}

    context.locals.runtime.ctx.waitUntil((async () => {
      try {
        const reads = [kv.get(`stats:pageviews:${today}`)];
        if (refDomain) reads.push(kv.get(`stats:referrers:${today}`));
        const [pvRaw, refRaw] = await Promise.all(reads);

        const puts = [
          kv.put(`stats:pageviews:${today}`, String((parseInt(pvRaw || '0', 10) || 0) + 1)),
        ];

        if (refDomain) {
          const referrers = refRaw ? JSON.parse(refRaw) : {};
          referrers[refDomain] = (referrers[refDomain] || 0) + 1;
          puts.push(kv.put(`stats:referrers:${today}`, JSON.stringify(referrers)));
        }

        await Promise.all(puts);
      } catch {}
    })());
  } catch {}

  return response;
});
