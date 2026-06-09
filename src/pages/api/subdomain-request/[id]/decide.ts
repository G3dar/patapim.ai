import type { APIRoute } from 'astro';
import { getUserFromRequest, assertSameOrigin } from '../../../../lib/auth';
import {
  loadSubReq,
  saveSubReq,
  clearDedupe,
  dispatchTeamTask,
  type TeamTaskEnvelope,
} from '../../../../lib/subdomainRequests';

export const prerender = false;

// POST /api/subdomain-request/:id/decide — the team owner approves or rejects.
// Auth is the Google OAuth session ONLY (never the team token) plus a
// same-origin check: this is the gate that keeps employees from approving
// their own requests. On approve, the structured task is pushed to the owner's
// desktop via the Telegram-relay Durable Object.
export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const siteUrl = env.SITE_URL || 'https://patapim.ai';
  const headers = { 'Content-Type': 'application/json' };

  if (!assertSameOrigin(context.request, siteUrl)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers });
  }

  const user = await getUserFromRequest(env.SESSIONS, context.request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });
  }

  const id = context.params.id || '';
  const subreq = await loadSubReq(env.LICENSES, id);
  if (!subreq) {
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers });
  }
  // The core authorization gate: only the team owner can decide.
  if (subreq.ownerGoogleId !== user.googleId) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers });
  }

  let body: { decision?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_body' }), { status: 400, headers });
  }
  const decision = body.decision;
  if (decision !== 'approve' && decision !== 'reject') {
    return new Response(JSON.stringify({ error: 'invalid_decision' }), { status: 400, headers });
  }

  // Replay-safe: only a pending request can be decided. A second click on an
  // already-decided request is a no-op that echoes the current state.
  if (subreq.status !== 'pending') {
    return new Response(JSON.stringify({ status: subreq.status, alreadyDecided: true }), {
      status: 200,
      headers,
    });
  }

  const now = new Date().toISOString();
  subreq.decidedAt = now;
  subreq.decidedBy = user.googleId;

  if (decision === 'reject') {
    subreq.status = 'rejected';
    await saveSubReq(env.LICENSES, subreq);
    await clearDedupe(env.LICENSES, subreq.ownerGoogleId, subreq.subdomain);
    return new Response(JSON.stringify({ status: 'rejected' }), { status: 200, headers });
  }

  // approve
  subreq.status = 'approved';
  subreq.dispatchedAt = now;
  await saveSubReq(env.LICENSES, subreq);

  const task: TeamTaskEnvelope = {
    kind: 'create_subdomain',
    requestId: subreq.id,
    subdomain: subreq.subdomain,
    callbackSecret: subreq.callbackSecret,
    callbackUrl: `${siteUrl}/api/subdomain-request/${subreq.id}/result`,
  };
  if (subreq.requesterGithub) task.requesterGithub = subreq.requesterGithub;
  if (subreq.existingRepo) task.existingRepo = subreq.existingRepo;
  // delivered=false just means "queued / desktop offline" — the request stays
  // 'approved' and the desktop picks it up on reconnect via the DO queue.
  const { delivered } = await dispatchTeamTask(env, subreq.ownerInstanceId, task);

  return new Response(JSON.stringify({ status: 'approved', dispatched: delivered }), {
    status: 200,
    headers,
  });
};
