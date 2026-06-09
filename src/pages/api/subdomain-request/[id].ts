import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';
import { parseBearerToken, getUserFromRequest } from '../../../lib/auth';
import { loadTeam, loadSubReq, publicSubReq } from '../../../lib/subdomainRequests';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

// GET /api/subdomain-request/:id — status poll. Readable with either the team
// token (the employee's request script polls here) or the owner's session
// cookie (the approval page polls here). Either way it's scoped to the owner.
export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  const id = context.params.id || '';

  // --- auth: team-token Bearer OR the owner's session cookie ---
  let ownerGoogleId: string | null = null;
  const token = parseBearerToken(context.request);
  if (token) {
    const team = await loadTeam(env.LICENSES, token);
    if (team) ownerGoogleId = team.ownerGoogleId;
  }
  if (!ownerGoogleId) {
    const user = await getUserFromRequest(env.SESSIONS, context.request);
    if (user) ownerGoogleId = user.googleId;
  }
  if (!ownerGoogleId) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });
  }

  const subreq = await loadSubReq(env.LICENSES, id);
  if (!subreq) {
    // Not found = expired (7-day TTL) or never existed. Terminal either way —
    // the poller should stop.
    return new Response(JSON.stringify({ status: 'expired_or_unknown' }), {
      status: 404,
      headers,
    });
  }
  if (subreq.ownerGoogleId !== ownerGoogleId) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers });
  }

  return new Response(JSON.stringify(publicSubReq(subreq)), { status: 200, headers });
};
