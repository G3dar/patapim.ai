// Fetches the latest published PATAPIM desktop version from the same public
// Gist the desktop app's own auto-updater reads (patapim-version.json),
// cached in-memory for the Worker isolate's lifetime so we don't hit
// GitHub's unauthenticated rate limit on every /api/device/list poll.
const GIST_ID = 'c89538d59e1e66f08a143d7d25b0d6dc';
const GIST_FILENAME = 'patapim-version.json';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let cached: { version: string; fetchedAt: number } | null = null;

export async function getLatestVersion(): Promise<string | null> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.version;
  }
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'patapim-ai-worker' },
    });
    if (!res.ok) return cached ? cached.version : null;
    const gist = await res.json() as { files?: Record<string, { content?: string }> };
    const file = gist.files?.[GIST_FILENAME];
    if (!file?.content) return cached ? cached.version : null;
    const info = JSON.parse(file.content) as { version?: string };
    if (!info.version) return cached ? cached.version : null;
    cached = { version: info.version, fetchedAt: Date.now() };
    return info.version;
  } catch {
    return cached ? cached.version : null;
  }
}

/**
 * True if `deviceVersion` is older than `latestVersion`. Both are plain
 * dotted-numeric strings (e.g. "1.5.13"); compares numerically part by part
 * so "1.5.9" < "1.5.10" (a plain string compare would get that backwards).
 */
export function isOlderVersion(deviceVersion: string, latestVersion: string): boolean {
  const a = deviceVersion.split('.').map((n) => parseInt(n, 10) || 0);
  const b = latestVersion.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av !== bv) return av < bv;
  }
  return false;
}
