// APNs sender for the PATAPIM mobile app (com.patapim.remote).
//
// Secrets (wrangler secret put):
//   APNS_P8      — contents of the .p8 auth key (PEM, BEGIN/END PRIVATE KEY)
//   APNS_KEY_ID  — the key's 10-char id
//   APNS_TEAM_ID — Apple team (93K49S8Q8U)
// Optional vars: APNS_TOPIC (default com.patapim.remote),
//   APNS_HOST — default host for PRODUCTION tokens ('api.push.apple.com' |
//   'api.sandbox.push.apple.com'). Tokens registered with environment 'sandbox'
//   (dev-signed builds, aps-environment=development) always go to the sandbox
//   host regardless of APNS_HOST; leave APNS_HOST unset in normal operation.
//
// NOTE: APNs' provider API is HTTP/2-only. If the runtime's outbound fetch
// cannot negotiate HTTP/2 with APNs, sends fail with a transport error — the
// documented fallback is FCM HTTP v1 (HTTP/1.1-friendly and Android-ready);
// swap sendApns() for an FCM sender without touching the endpoints.

export type ApnsEnvironment = 'production' | 'sandbox';

export const APNS_PRODUCTION_HOST = 'api.push.apple.com';
export const APNS_SANDBOX_HOST = 'api.sandbox.push.apple.com';
const APNS_HOSTS: readonly string[] = [APNS_PRODUCTION_HOST, APNS_SANDBOX_HOST];
const DEFAULT_TOPIC = 'com.patapim.remote';
/** Deliver within this window, then let APNs drop the push (a stale "finished" banner is noise). */
export const APNS_DEFAULT_TTL_SEC = 3600;

/** One registered mobile push token, stored at LICENSES `push:<googleId>` as a list. */
export interface PushTokenRecord {
  token: string;
  platform: 'ios' | 'android';
  /** Absent on records written before environment routing existed → 'production'. */
  environment?: ApnsEnvironment;
  addedAt: string;
}

export function pushTokensKey(googleId: string): string {
  return `push:${googleId}`;
}

/** Minimal KV surface so this module does not depend on the workers-types globals. */
interface KvReadLike {
  get(key: string): Promise<string | null>;
}
interface KvLike extends KvReadLike {
  put(key: string, value: string): Promise<void>;
}

/** Read the account's token list; corrupt/missing → []. Unknown shapes are dropped. */
export async function loadPushTokens(kv: KvReadLike, googleId: string): Promise<PushTokenRecord[]> {
  let raw: unknown = [];
  try { raw = JSON.parse((await kv.get(pushTokensKey(googleId))) || '[]'); } catch { raw = []; }
  if (!Array.isArray(raw)) return [];
  const out: PushTokenRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const t = item as Record<string, unknown>;
    if (typeof t.token !== 'string' || !t.token) continue;
    out.push({
      token: t.token,
      platform: t.platform === 'android' ? 'android' : 'ios',
      environment: normalizeEnvironment(t.environment),
      addedAt: typeof t.addedAt === 'string' ? t.addedAt : '',
    });
  }
  return out;
}

/**
 * Remove dead tokens from the account's list. Re-reads the list immediately
 * before writing (not the snapshot the caller fanned out from) and removes ONLY
 * the given tokens, so a token the phone registered while APNs was being
 * contacted survives the prune. KV has no CAS, so this narrows the lost-update
 * window to the single get→put below rather than closing it; it never writes
 * when the fresh list already lacks every dead token. Returns how many entries
 * were actually removed.
 */
export async function prunePushTokens(kv: KvLike, googleId: string, deadTokens: readonly string[]): Promise<number> {
  if (!deadTokens.length) return 0;
  const dead = new Set(deadTokens);
  const fresh = await loadPushTokens(kv, googleId);
  const kept = fresh.filter((t) => !dead.has(t.token));
  const removed = fresh.length - kept.length;
  if (removed > 0) await kv.put(pushTokensKey(googleId), JSON.stringify(kept));
  return removed;
}

/** 'sandbox' only when explicitly asked for; everything else (incl. legacy records) is production. */
export function normalizeEnvironment(value: unknown): ApnsEnvironment {
  return value === 'sandbox' ? 'sandbox' : 'production';
}

// The Worker's `Env` interface does not declare the APNs secrets (they are
// optional and only present after `wrangler secret put`), so callers pass the
// runtime env as-is and we read the fields loosely here.
interface ApnsVars {
  APNS_P8?: string;
  APNS_KEY_ID?: string;
  APNS_TEAM_ID?: string;
  APNS_TOPIC?: string;
  APNS_HOST?: string;
}

function vars(env: object): ApnsVars {
  return env as ApnsVars;
}

let cachedJwt: { token: string; iat: number; keyId: string } | null = null;

function b64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function getJwt(v: ApnsVars): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // APNs rejects tokens older than 1 h and more frequent than 1/20 min — reuse for 50 min.
  if (cachedJwt && cachedJwt.keyId === v.APNS_KEY_ID && now - cachedJwt.iat < 3000) return cachedJwt.token;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(v.APNS_P8!),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: v.APNS_KEY_ID }));
  const claims = b64url(JSON.stringify({ iss: v.APNS_TEAM_ID, iat: now }));
  const unsigned = `${header}.${claims}`;
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned),
  );
  const token = `${unsigned}.${b64url(sig)}`;
  cachedJwt = { token, iat: now, keyId: v.APNS_KEY_ID! };
  return token;
}

export function apnsConfigured(env: object): boolean {
  const v = vars(env);
  return !!(v.APNS_P8 && v.APNS_KEY_ID && v.APNS_TEAM_ID);
}

/** Host a token of the given environment is sent to. */
export function apnsHost(env: object, environment: ApnsEnvironment = 'production'): string {
  if (environment === 'sandbox') return APNS_SANDBOX_HOST;
  const configured = vars(env).APNS_HOST;
  return configured && APNS_HOSTS.includes(configured) ? configured : APNS_PRODUCTION_HOST;
}

export function apnsTopic(env: object): string {
  const t = vars(env).APNS_TOPIC;
  return t && /^[A-Za-z0-9.-]{1,128}$/.test(t) ? t : DEFAULT_TOPIC;
}

/** apns-collapse-id must be ≤ 64 bytes; keep it to a safe ASCII subset. */
export function sanitizeCollapseId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 64);
  return cleaned || undefined;
}

export interface ApnsResult {
  ok: boolean;
  status: number;
  /**
   * true only on a hard-dead signal: HTTP 410, reason 'Unregistered' or
   * 'ExpiredToken'. NOT set for BadDeviceToken — Apple also returns that for a
   * valid token sent to the wrong environment (e.g. APNS_HOST pointed at the
   * sandbox), so pruning on it would wipe every real registration under a
   * misconfiguration. BadDeviceToken is still surfaced via `reason`.
   */
  gone: boolean;
  /**
   * APNs `reason` (BadDeviceToken, TopicDisallowed, ...), `transport: <msg>` when
   * fetch itself failed (HTTP/2 caveat above), `invalid_key: <msg>` when the .p8
   * could not be imported, or `status <n>` when APNs answered without a body.
   */
  reason?: string;
  /** Which APNs host the push was sent to. */
  environment: ApnsEnvironment;
}

export interface ApnsPayload {
  title: string;
  /** Shown under the title on iOS — we use the computer (host) name. */
  subtitle?: string;
  body: string;
  /** Custom top-level keys delivered to the app (terminalId, kind, deviceName). */
  data?: Record<string, string>;
  /** aps.thread-id — groups banners per terminal in Notification Center. */
  threadId?: string;
  /** apns-collapse-id — a newer push with the same id replaces the older banner. */
  collapseId?: string;
  /** Picks the APNs host for this token (default production). */
  environment?: ApnsEnvironment;
  /** Seconds the push may wait for an offline device (default APNS_DEFAULT_TTL_SEC). */
  ttlSec?: number;
}

export async function sendApns(
  env: object,
  deviceToken: string,
  payload: ApnsPayload,
): Promise<ApnsResult> {
  const v = vars(env);
  const environment = normalizeEnvironment(payload.environment);
  const host = apnsHost(env, environment);
  const topic = apnsTopic(env);

  let jwt: string;
  try {
    jwt = await getJwt(v);
  } catch (e) {
    cachedJwt = null;
    return { ok: false, status: 0, gone: false, reason: `invalid_key: ${(e as Error).message}`, environment };
  }

  const alert: { title: string; subtitle?: string; body: string } = { title: payload.title, body: payload.body };
  if (payload.subtitle) alert.subtitle = payload.subtitle;
  // Custom keys first so a stray `aps` key in data can never shadow the real one.
  const aps = {
    ...(payload.data || {}),
    aps: {
      alert,
      sound: 'default',
      'thread-id': payload.threadId || 'patapim-terminal',
    },
  };

  const ttl = Number.isFinite(payload.ttlSec) && (payload.ttlSec as number) > 0
    ? Math.floor(payload.ttlSec as number)
    : APNS_DEFAULT_TTL_SEC;
  const headers: Record<string, string> = {
    authorization: `bearer ${jwt}`,
    'apns-topic': topic,
    'apns-push-type': 'alert',
    'apns-priority': '10',
    'apns-expiration': String(Math.floor(Date.now() / 1000) + ttl),
    'content-type': 'application/json',
  };
  const collapseId = sanitizeCollapseId(payload.collapseId);
  if (collapseId) headers['apns-collapse-id'] = collapseId;

  try {
    const res = await fetch(`https://${host}/3/device/${encodeURIComponent(deviceToken)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(aps),
    });
    let reason: string | undefined;
    if (res.status !== 200) {
      try { reason = ((await res.json()) as { reason?: string }).reason; } catch { /* empty body */ }
      if (!reason) reason = `status ${res.status}`;
      // A rejected provider token must not be reused for the next 50 minutes.
      if (reason === 'ExpiredProviderToken' || reason === 'InvalidProviderToken') cachedJwt = null;
    }
    return {
      ok: res.status === 200,
      status: res.status,
      gone: res.status === 410 || reason === 'Unregistered' || reason === 'ExpiredToken',
      reason,
      environment,
    };
  } catch (e) {
    // Most likely the HTTP/2 transport limitation — surface distinctly.
    return { ok: false, status: 0, gone: false, reason: `transport: ${(e as Error).message}`, environment };
  }
}
