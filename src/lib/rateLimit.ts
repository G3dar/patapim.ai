// Sliding-window rate limiter backed by Cloudflare KV. Counts events in
// fixed-size buckets keyed by an arbitrary string. KV is eventually consistent
// (~60s globally), so a determined attacker hitting different POPs can exceed
// the limit by a small factor — acceptable for our use case (slow brute force
// resistance, not strict quota enforcement).

interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

interface RateLimitResult {
  ok: boolean;
  retryAfter: number;
}

export async function rateLimit(
  kv: KVNamespace,
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const k = `rl:${key}`;
  const now = Math.floor(Date.now() / 1000);

  const raw = await kv.get(k);
  let bucket: { start: number; count: number } | null = null;
  if (raw) {
    try { bucket = JSON.parse(raw); } catch { bucket = null; }
  }

  if (!bucket || now - bucket.start >= opts.windowSeconds) {
    bucket = { start: now, count: 1 };
    await kv.put(k, JSON.stringify(bucket), { expirationTtl: opts.windowSeconds + 5 });
    return { ok: true, retryAfter: 0 };
  }

  if (bucket.count >= opts.limit) {
    return { ok: false, retryAfter: opts.windowSeconds - (now - bucket.start) };
  }

  bucket.count += 1;
  await kv.put(k, JSON.stringify(bucket), { expirationTtl: opts.windowSeconds + 5 });
  return { ok: true, retryAfter: 0 };
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}

export function tooManyRequests(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ ok: false, error: 'too_many_requests', retryAfter }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(1, retryAfter)),
      },
    },
  );
}
