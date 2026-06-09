import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';
import { parseBearerToken, randomToken } from '../../../lib/auth';
import { sendSubdomainApproval } from '../../../lib/email';
import {
  SUBDOMAIN_RE,
  GH_USER_RE,
  GH_REPO_RE,
  loadTeam,
  loadSubReq,
  saveSubReq,
  getDedupe,
  setDedupe,
  type SubReq,
} from '../../../lib/subdomainRequests';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

// POST /api/subdomain-request — a 3DAR employee requests a new <name>.3dar.com
// subdomain. Auth is the create-only team token (Bearer). This route never
// touches cloud credentials; it only records the request and emails the owner.
export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  // --- auth: create-only team token ---
  const token = parseBearerToken(context.request);
  const team = token ? await loadTeam(env.LICENSES, token) : null;
  if (!team) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });
  }

  // --- body ---
  let body: {
    subdomain?: unknown;
    requesterName?: unknown;
    requesterGithub?: unknown;
    existingRepo?: unknown;
  };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_body' }), { status: 400, headers });
  }

  const subdomain = typeof body.subdomain === 'string' ? body.subdomain.trim().toLowerCase() : '';
  if (!SUBDOMAIN_RE.test(subdomain)) {
    return new Response(JSON.stringify({ error: 'invalid_subdomain' }), { status: 400, headers });
  }
  // Requester name is display-only; strip HTML-significant chars so it can be
  // dropped straight into the approval email without escaping.
  const requesterName =
    typeof body.requesterName === 'string'
      ? body.requesterName.replace(/[<>&"]/g, '').trim().slice(0, 80)
      : '';
  // GitHub username — optional, used for collaborator add. Reject anything
  // malformed rather than silently dropping it (the requester would get a
  // subdomain without push access and not know why).
  let requesterGithub: string | null = null;
  if (typeof body.requesterGithub === 'string' && body.requesterGithub.trim()) {
    const v = body.requesterGithub.trim();
    if (!GH_USER_RE.test(v)) {
      return new Response(JSON.stringify({ error: 'invalid_requester_github' }), {
        status: 400,
        headers,
      });
    }
    requesterGithub = v;
  }
  // Existing repo — optional, "owner/name". Same fail-loud policy.
  let existingRepo: string | null = null;
  if (typeof body.existingRepo === 'string' && body.existingRepo.trim()) {
    const v = body.existingRepo.trim();
    if (!GH_REPO_RE.test(v)) {
      return new Response(JSON.stringify({ error: 'invalid_existing_repo' }), {
        status: 400,
        headers,
      });
    }
    existingRepo = v;
  }

  // --- dedupe: collapse a re-request for the same still-open subdomain ---
  const existingId = await getDedupe(env.LICENSES, team.ownerGoogleId, subdomain);
  if (existingId) {
    const existing = await loadSubReq(env.LICENSES, existingId);
    if (existing && ['pending', 'approved', 'running'].includes(existing.status)) {
      return new Response(
        JSON.stringify({ id: existing.id, status: existing.status, deduped: true }),
        { status: 200, headers },
      );
    }
  }

  // --- create ---
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const subreq: SubReq = {
    id,
    subdomain,
    ownerGoogleId: team.ownerGoogleId,
    ownerInstanceId: team.ownerInstanceId,
    callbackSecret: randomToken(32),
    requesterName,
    requesterGithub,
    existingRepo,
    status: 'pending',
    createdAt: now,
    decidedAt: null,
    decidedBy: null,
    dispatchedAt: null,
    finishedAt: null,
    result: null,
    error: null,
  };
  await saveSubReq(env.LICENSES, subreq);
  await setDedupe(env.LICENSES, team.ownerGoogleId, subdomain, id);

  // --- email the owner (off the response path) ---
  const siteUrl = env.SITE_URL || 'https://patapim.ai';
  const approveUrl = `${siteUrl}/approve-subdomain?id=${id}`;
  context.locals.runtime.ctx.waitUntil(
    sendSubdomainApproval(env, team.ownerEmail, subdomain, requesterName, approveUrl).catch((e) =>
      console.error('subdomain approval email failed:', e),
    ),
  );

  return new Response(JSON.stringify({ id, status: 'pending' }), { status: 200, headers });
};
