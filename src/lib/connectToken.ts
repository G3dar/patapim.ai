/**
 * v2 self-verifying connect tokens.
 *
 * Format: `v2.<b64url(payloadJson)>.<b64url(hmacSha256(key, payloadJson))>`
 *   payload = { googleId, email, dt8, jti, iat, exp }
 *   dt8     = hex(sha256(deviceToken)).slice(0, 16)  — binds token to device
 *   key     = sha256(deviceToken + ':patapim-connect-v2')
 *
 * The signing key is derivable only with the deviceToken — exactly the secret
 * whose compromise already grants full device auth, so no new attack surface.
 * The DESKTOP verifies these locally (remoteServer.js verifyConnectTokenV2Local
 * — keep the two implementations in sync), which removes the KV cross-POP
 * consistency stall (worker 1.5s in-request sleep + 3×1.5s client retries,
 * up to ~9s inside auth) from the connect path entirely. The phone never sees
 * the deviceToken: the payload carries only a 64-bit hash prefix.
 */

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

async function hmacKey(deviceToken: string): Promise<CryptoKey> {
  const keyBytes = await sha256(deviceToken + ':patapim-connect-v2');
  return crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function deviceTokenHash8(deviceToken: string): Promise<string> {
  const h = await sha256(deviceToken);
  return Array.from(h).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

export async function mintV2ConnectToken(
  deviceToken: string,
  user: { googleId: string; email?: string | null },
  ttlSeconds = 300,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    googleId: user.googleId,
    email: user.email || null,
    dt8: await deviceTokenHash8(deviceToken),
    jti: crypto.randomUUID(),
    iat,
    exp: iat + ttlSeconds,
  });
  const key = await hmacKey(deviceToken);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
  return 'v2.' + b64url(enc.encode(payload)) + '.' + b64url(sig);
}

/** Stateless server-side verification (mixed-rollout fallback: an old app that
 * can't verify locally POSTs the v2 token to verify-connect — we hold the
 * deviceToken from its Bearer header and can recompute the HMAC, no KV). */
export async function verifyV2ConnectToken(
  token: string,
  deviceToken: string,
): Promise<{ valid: boolean; error?: string; payload?: { googleId: string; email: string | null; jti: string } }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'v2') return { valid: false, error: 'Malformed connect token' };
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const key = await hmacKey(deviceToken);
    const sigBin = atob(parts[2].replace(/-/g, '+').replace(/_/g, '/'));
    const sig = new Uint8Array(sigBin.length);
    for (let i = 0; i < sigBin.length; i++) sig[i] = sigBin.charCodeAt(i);
    const ok = await crypto.subtle.verify('HMAC', key, sig as BufferSource, enc.encode(payloadJson));
    if (!ok) return { valid: false, error: 'Invalid connect token signature' };
    const payload = JSON.parse(payloadJson);
    if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) {
      return { valid: false, error: 'Invalid or expired connect token' };
    }
    if (payload.dt8 !== await deviceTokenHash8(deviceToken)) {
      return { valid: false, error: 'Connect token is for another device' };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Failed to verify connect token' };
  }
}

/** True when `appVersion` (e.g. "1.5.19") is >= `min`. Unknown/absent → false. */
export function appVersionAtLeast(appVersion: unknown, min: string): boolean {
  if (typeof appVersion !== 'string') return false;
  const a = appVersion.split('.').map(n => parseInt(n, 10));
  const b = min.split('.').map(n => parseInt(n, 10));
  if (a.some(isNaN)) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return true;
}

/** First app version whose remoteServer verifies v2 tokens locally. Devices
 * heartbeating an older version keep getting legacy KV-backed UUID tokens.
 * Roll back v2 issuance entirely by setting this to 'Infinity' semantics
 * (e.g. '9999.0.0'). */
export const MIN_V2_APP_VERSION = '1.5.19';
