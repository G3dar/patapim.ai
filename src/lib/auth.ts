export const COOKIE_NAME = '__patapim_session';
export const SESSION_TTL = 604800; // 7 days
export const STATE_TTL = 600; // 10 minutes
// Long-lived bearer token minted for the native iOS app so it can call the
// device APIs (list / connect-token) without the HttpOnly session cookie,
// which JS cannot read and Swift cannot ferry out of ASWebAuthenticationSession.
export const NATIVE_SESSION_PREFIX = 'nt_';
export const NATIVE_SESSION_TTL = 90 * 24 * 60 * 60; // 90 days

// `googleId` is the user's primary identifier across the codebase. For users
// who signed up via Google OAuth it's their real Google sub; for users who
// signed up with email+password it's a UUID we mint at signup. Either way it
// is opaque and stable.
export interface SessionUser {
  googleId: string;
  email: string;
  name: string;
  picture: string;
  issuedAt?: string;
}

export interface AuthenticatedUser {
  googleId: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface UserRecord {
  googleId: string;
  email: string;
  name: string;
  picture: string;
  createdAt: string;
  lastLogin: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  passwordHash?: string;
  passwordChangedAt?: string;
  linkedGoogleId?: string;
}

export async function createSession(kv: KVNamespace, userData: SessionUser): Promise<string> {
  const sessionId = crypto.randomUUID();
  const payload: SessionUser = {
    ...userData,
    issuedAt: userData.issuedAt || new Date().toISOString(),
  };
  await kv.put(sessionId, JSON.stringify(payload), { expirationTtl: SESSION_TTL });
  return sessionId;
}

export async function getSession(kv: KVNamespace, sessionId: string): Promise<SessionUser | null> {
  const raw = await kv.get(sessionId);
  if (!raw) return null;
  return JSON.parse(raw) as SessionUser;
}

export async function deleteSession(kv: KVNamespace, sessionId: string): Promise<void> {
  await kv.delete(sessionId);
}

export function parseCookie(request: Request): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

export async function getUserFromRequest(sessions: KVNamespace, request: Request): Promise<SessionUser | null> {
  const sessionId = parseCookie(request);
  if (!sessionId) return null;
  return getSession(sessions, sessionId);
}

// Returns the session user, but rejects sessions issued before the user's
// passwordChangedAt timestamp (used to invalidate older sessions on password
// reset/change without iterating KV).
export async function getValidSession(
  sessions: KVNamespace,
  licenses: KVNamespace,
  request: Request,
): Promise<SessionUser | null> {
  const session = await getUserFromRequest(sessions, request);
  if (!session) return null;
  if (!session.issuedAt) return session;

  const user = await loadUserById(licenses, session.googleId);
  if (!user || !user.passwordChangedAt) return session;

  if (new Date(session.issuedAt).getTime() < new Date(user.passwordChangedAt).getTime()) {
    return null;
  }
  return session;
}

export function parseBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

export async function getUserFromDeviceToken(licenses: KVNamespace, request: Request): Promise<AuthenticatedUser | null> {
  const deviceToken = parseBearerToken(request);
  if (!deviceToken) return null;

  const raw = await licenses.get(`device:${deviceToken}`);
  if (!raw) return null;

  let device: { googleId?: string; email?: string; deviceName?: string };
  try {
    device = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!device.googleId || !device.email) return null;

  return {
    googleId: device.googleId,
    email: device.email,
    name: device.deviceName || 'PATAPIM Desktop',
    picture: '',
  };
}

// Mint a long-lived bearer token for the native iOS app. Stored in SESSIONS
// KV under `native-session:<token>`. The app stores it in the Keychain and
// sends it as `Authorization: Bearer nt_...` to the device APIs.
export async function createNativeSession(sessions: KVNamespace, user: SessionUser): Promise<string> {
  const token = NATIVE_SESSION_PREFIX + crypto.randomUUID().replace(/-/g, '');
  const payload: SessionUser = {
    googleId: user.googleId,
    email: user.email,
    name: user.name,
    picture: user.picture,
    issuedAt: new Date().toISOString(),
  };
  await sessions.put(`native-session:${token}`, JSON.stringify(payload), { expirationTtl: NATIVE_SESSION_TTL });
  return token;
}

export async function getUserFromNativeToken(sessions: KVNamespace, request: Request): Promise<AuthenticatedUser | null> {
  const token = parseBearerToken(request);
  if (!token || !token.startsWith(NATIVE_SESSION_PREFIX)) return null;
  const raw = await sessions.get(`native-session:${token}`);
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as SessionUser;
    if (!u.googleId || !u.email) return null;
    return { googleId: u.googleId, email: u.email, name: u.name, picture: u.picture };
  } catch {
    return null;
  }
}

export async function getUserFromRequestOrDeviceToken(
  sessions: KVNamespace,
  licenses: KVNamespace,
  request: Request
): Promise<AuthenticatedUser | null> {
  const sessionUser = await getUserFromRequest(sessions, request);
  if (sessionUser) {
    return sessionUser;
  }
  // Native iOS bearer token (nt_...) — looked up in SESSIONS before falling
  // back to a desktop device token (looked up in LICENSES).
  const nativeUser = await getUserFromNativeToken(sessions, request);
  if (nativeUser) {
    return nativeUser;
  }
  return getUserFromDeviceToken(licenses, request);
}

export function buildSessionCookie(sessionId: string): string {
  return `${COOKIE_NAME}=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`;
}

export function buildClearCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

// ---------- User record CRUD ----------

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function loadUserById(licenses: KVNamespace, userId: string): Promise<UserRecord | null> {
  const raw = await licenses.get(`user:${userId}`);
  return raw ? (JSON.parse(raw) as UserRecord) : null;
}

export async function loadUserByEmail(licenses: KVNamespace, email: string): Promise<UserRecord | null> {
  const userId = await licenses.get(`user-email:${normalizeEmail(email)}`);
  if (!userId) return null;
  return loadUserById(licenses, userId);
}

export async function loadUserByGoogleId(licenses: KVNamespace, googleId: string): Promise<UserRecord | null> {
  // 1. Fast path: explicit index (set for newly-merged accounts)
  const indexedUserId = await licenses.get(`user-google:${googleId}`);
  if (indexedUserId) return loadUserById(licenses, indexedUserId);

  // 2. Legacy path: user records keyed directly by googleId
  return loadUserById(licenses, googleId);
}

export async function saveUser(licenses: KVNamespace, user: UserRecord): Promise<void> {
  const email = normalizeEmail(user.email);
  await Promise.all([
    licenses.put(`user:${user.googleId}`, JSON.stringify(user)),
    licenses.put(`user-email:${email}`, user.googleId),
    user.linkedGoogleId
      ? licenses.put(`user-google:${user.linkedGoogleId}`, user.googleId)
      : Promise.resolve(),
  ]);
}

// ---------- Password hashing (PBKDF2-SHA256, 600k, Web Crypto) ----------

// Cloudflare Workers caps PBKDF2 iterations at 100k. This is below the OWASP
// 2023 600k recommendation but still well above NIST's 10k floor, and is the
// hard ceiling we have to live with on this runtime. The version-prefixed
// hash format lets us bump this if Workers ever raises the cap, or migrate
// to a different KDF without invalidating existing hashes.
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32; // 256 bits
const PBKDF2_SALT_LEN = 16;

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number, keyLen: number): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMat = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMat,
    keyLen * 8,
  );
  return new Uint8Array(bits);
}

export async function pbkdf2Hash(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_LEN));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN);
  return `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

export async function pbkdf2Verify(stored: string, password: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;
  const iterations = parseInt(parts[2], 10);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;
  const salt = base64ToBytes(parts[3]);
  const expected = base64ToBytes(parts[4]);
  const actual = await pbkdf2(password, salt, iterations, expected.length);
  return timingSafeEqual(actual, expected);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ---------- Tokens ----------

// 32-byte cryptographically random base64url string. Used for password reset
// and email verification links.
export function randomToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return bytesToBase64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------- CSRF ----------

// Verifies the request was initiated from our own origin. Combined with the
// SameSite=Lax cookie this protects state-changing endpoints from CSRF.
export function assertSameOrigin(request: Request, siteUrl: string): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const expected = new URL(siteUrl).origin;

  if (origin) return origin === expected;
  if (referer) {
    try {
      return new URL(referer).origin === expected;
    } catch {
      return false;
    }
  }
  // No Origin/Referer means the request didn't come from a browser context.
  // Reject — we don't expect bare programmatic POSTs to these endpoints.
  return false;
}
