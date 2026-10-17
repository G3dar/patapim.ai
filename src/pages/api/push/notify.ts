import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';
import { getUserFromDeviceToken } from '../../../lib/auth';
import { apnsConfigured, loadPushTokens, prunePushTokens, sanitizeCollapseId, sendApns } from '../../../lib/apns';
import type { ApnsResult } from '../../../lib/apns';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

// Called by the DESKTOP (Bearer deviceToken) when a terminal transitions into
// needs-attention / awaiting-response / plan-ready, or for a user-triggered
// test push. Fans out to the account's registered mobile push tokens, routing
// each token to the APNs host of its registered environment (sandbox tokens
// from dev builds, production otherwise). Hard-dead tokens (410 / Unregistered /
// ExpiredToken) are pruned by re-reading the list right before the write and
// removing only those tokens, so a concurrent /register is not clobbered.
// BadDeviceToken is reported in `error` but NOT pruned (it is also what APNs
// answers for a valid token sent to the wrong environment).
//
// Body: { terminalId, terminalName, kind, title, subtitle?, body, collapseId?, deviceName? }
// Reply: 200 { ok, sent, pruned, error? }   — `error` is precise so the host can
//                                             surface it: an APNs reason
//                                             (BadDeviceToken, TopicDisallowed…),
//                                             'transport: …', 'invalid_key: …',
//                                             'no_tokens', or 'status <n>'.
//        503 { ok:false, error:'not_configured' } — APNs secrets missing.
//        401 { error:'Unauthorized' }

const KNOWN_KINDS = new Set(['needsAttention', 'awaiting', 'planReady', 'test']);

function sanitizeKind(value: unknown): string {
  if (typeof value !== 'string') return '';
  if (KNOWN_KINDS.has(value)) return value;
  // Tolerate future kinds from newer hosts, but keep the key printable and short.
  return /^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(value) ? value : '';
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  // Strip control characters; APNs payloads are JSON but the banner is plain text.
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const headers = { 'Content-Type': 'application/json', ...getCorsHeaders(context.request) };

  const user = await getUserFromDeviceToken(env.LICENSES, context.request);
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });

  if (!apnsConfigured(env)) {
    return new Response(JSON.stringify({ ok: false, sent: 0, error: 'not_configured' }), { status: 503, headers });
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await context.request.json();
    if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
  } catch { /* fallthrough: defaults below */ }

  const title = text(body.title, 120) || text(body.terminalName, 120) || 'Terminal ready';
  const subtitle = text(body.subtitle, 120) || text(body.deviceName, 120) || undefined;
  const message = text(body.body, 240) || 'An agent needs you.';
  const terminalId = text(body.terminalId, 64);
  const kind = sanitizeKind(body.kind);
  const deviceName = text(body.deviceName, 120);
  const collapseId = sanitizeCollapseId(body.collapseId) || sanitizeCollapseId(terminalId);

  const list = await loadPushTokens(env.LICENSES, user.googleId);
  if (!list.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, pruned: 0, error: 'no_tokens' }), { status: 200, headers });
  }

  const dead: string[] = [];
  let sent = 0;
  const results: ApnsResult[] = await Promise.all(list.map(async (t) => {
    const r = await sendApns(env, t.token, {
      title,
      subtitle,
      body: message,
      threadId: terminalId || 'patapim-terminal',
      collapseId,
      environment: t.environment,
      data: { terminalId, kind, deviceName },
    });
    if (r.gone) dead.push(t.token);
    if (r.ok) sent++;
    return r;
  }));

  const pruned = await prunePushTokens(env.LICENSES, user.googleId, dead);

  // Prefer a non-"gone" failure as the headline error: a pruned dead token is
  // expected churn, whereas TopicDisallowed / transport errors need attention.
  const failures = results.filter((r) => !r.ok);
  const firstError = failures.find((r) => !r.gone) || failures[0];
  return new Response(JSON.stringify({
    ok: sent > 0,
    sent,
    pruned,
    tokens: list.length,
    ...(firstError ? { error: firstError.reason || `status ${firstError.status}`, errorEnvironment: firstError.environment } : {}),
  }), { status: 200, headers });
};
