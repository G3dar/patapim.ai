import type { APIRoute } from 'astro';
import { parseBearerToken } from '../../../../lib/auth';
import {
  loadSubReq,
  saveSubReq,
  clearDedupe,
  type SubReqStatus,
  type SubReqResult,
} from '../../../../lib/subdomainRequests';

export const prerender = false;

// Allowed status transitions, keyed by current status. `failed` can arrive
// from either `approved` (the runner rejected the task before starting) or
// `running` (deploy-sub.sh exited non-zero).
const VALID_NEXT: Record<string, SubReqStatus[]> = {
  approved: ['running', 'failed'],
  running: ['done', 'failed'],
};

// POST /api/subdomain-request/:id/result — the owner's PATAPIM desktop reports
// progress here. Auth is the one-time callbackSecret carried in the pushed
// task envelope (never exposed by the GET route). Called by the desktop runner,
// not a browser — no CORS.
export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const headers = { 'Content-Type': 'application/json' };

  const id = context.params.id || '';
  const subreq = await loadSubReq(env.LICENSES, id);
  if (!subreq) {
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers });
  }

  const secret = parseBearerToken(context.request);
  if (!secret || secret !== subreq.callbackSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });
  }

  let body: { status?: unknown; result?: SubReqResult; error?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_body' }), { status: 400, headers });
  }

  const next = body.status;
  if (next !== 'running' && next !== 'done' && next !== 'failed') {
    return new Response(JSON.stringify({ error: 'invalid_status' }), { status: 400, headers });
  }

  // Enforce ordering so a stale or duplicate callback can't rewind a finished
  // request (e.g. a queued-then-live double delivery on the desktop).
  const allowed = VALID_NEXT[subreq.status];
  if (!allowed || !allowed.includes(next)) {
    return new Response(
      JSON.stringify({ error: 'invalid_transition', from: subreq.status, to: next }),
      { status: 409, headers },
    );
  }

  subreq.status = next;
  if (body.result && typeof body.result === 'object') subreq.result = body.result;
  if (next === 'done' || next === 'failed') {
    subreq.finishedAt = new Date().toISOString();
    if (next === 'failed') {
      subreq.error = typeof body.error === 'string' ? body.error.slice(0, 2000) : 'unknown error';
    }
  }
  await saveSubReq(env.LICENSES, subreq);

  // Once terminal, free the dedupe slot so a fresh request can be made.
  if (next === 'done' || next === 'failed') {
    await clearDedupe(env.LICENSES, subreq.ownerGoogleId, subreq.subdomain);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
