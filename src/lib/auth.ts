export const COOKIE_NAME = '__patapim_session';
export const SESSION_TTL = 604800; // 7 days
export const STATE_TTL = 600; // 10 minutes

export interface SessionUser {
  googleId: string;
  email: string;
  name: string;
  picture: string;
}

export async function createSession(kv: KVNamespace, userData: SessionUser): Promise<string> {
  const sessionId = crypto.randomUUID();
  await kv.put(sessionId, JSON.stringify(userData), { expirationTtl: SESSION_TTL });
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

export function buildSessionCookie(sessionId: string): string {
  return `${COOKIE_NAME}=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`;
}

export function buildClearCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
