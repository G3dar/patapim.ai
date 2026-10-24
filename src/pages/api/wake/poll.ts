import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Wake agent poll endpoint. An always-on LAN device (Flic Hub SDK module, or
 * another awake PATAPIM) hits this every few seconds with its agent token. We
 * resolve the token to an account, drain that account's pending wake queue, and
 * return the target MAC addresses. The agent then broadcasts the magic packet
 * on its LAN — the only place on the path that can actually reach a sleeping
 * machine over UDP.
 *
 * Auth is the bearer-style agent token (query param, so it works from the very
 * limited Flic Hub http client). It only ever exposes the account's own pending
 * wake MACs, nothing else.
 */
export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  const token = new URL(context.request.url).searchParams.get('token');
  if (!token) {
    return new Response(JSON.stringify({ error: 'token required' }), { status: 400, headers });
  }

  const raw = await env.LICENSES.get(`wake-agent:${token}`);
  if (!raw) {
    return new Response(JSON.stringify({ error: 'Invalid agent token' }), { status: 403, headers });
  }

  let agent: { googleId?: string };
  try {
    agent = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: 'Agent corrupted' }), { status: 500, headers });
  }
  if (!agent.googleId) {
    return new Response(JSON.stringify({ error: 'Agent invalid' }), { status: 403, headers });
  }

  const key = `wake-queue:${agent.googleId}`;
  let jobs: Array<{ deviceName: string | null; macs: string[]; at: number }> = [];
  const q = await env.LICENSES.get(key);
  if (q) {
    try { jobs = JSON.parse(q); } catch {}
  }
  // Claim the queue: delete it so we don't fire the same wake forever.
  if (jobs.length) {
    await env.LICENSES.delete(key);
  }

  const nowMs = Date.now();
  const macs: string[] = [];
  const detail: Array<{ deviceName: string | null; macs: string[] }> = [];
  for (const j of jobs) {
    if (!j || nowMs - (j.at || 0) > 180000) continue; // ignore stale
    detail.push({ deviceName: j.deviceName ?? null, macs: j.macs || [] });
    for (const m of j.macs || []) {
      if (macs.indexOf(m) === -1) macs.push(m);
    }
  }

  return new Response(JSON.stringify({ macs, jobs: detail }), { status: 200, headers });
};
