import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

const MAX_BYTES = 256 * 1024;
const MAX_PROJECTS = 500;

const MAX_TOMBSTONES = 1000;

type SyncProject = {
  name: string;
  identity?: string;
  isPatapimProject?: boolean;
  addedAt?: string | null;
  metadataUpdatedAt?: string | null;
  archived?: boolean;
  order?: number;
  cloudSync?: boolean;
  autoGitSync?: boolean;
  syncthingSync?: boolean;
  gitRemote?: string;
  subfolders?: Array<{ name: string; gitMode?: string; order?: number }>;
};

type Tombstone = { identity: string; deletedAt: string };

/**
 * Backend twin of patapim/src/shared/projectIdentity.js `normalizeGitRemote`.
 * MUST stay in lockstep: lowercase BOTH host and path; strip scheme/creds/port/.git.
 * Used only as a fallback — clients send `identity` per project; this covers
 * legacy stored entries that predate the identity field.
 */
function normalizeGitRemote(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  let s = url.trim();
  if (!s) return null;
  s = s.replace(/^git\+/i, '');
  let host = '';
  let path = '';
  const scpMatch = s.match(/^(?:[^@/]+@)?([^/:]+):(.+)$/);
  if (scpMatch && !/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    host = scpMatch[1];
    path = scpMatch[2];
  } else {
    const schemeMatch = s.match(/^[a-z][a-z0-9+.-]*:\/\/(.+)$/i);
    let rest = schemeMatch ? schemeMatch[1] : s;
    rest = rest.replace(/^[^@/]+@/, '');
    const slash = rest.indexOf('/');
    if (slash === -1) { host = rest; path = ''; }
    else { host = rest.slice(0, slash); path = rest.slice(slash + 1); }
  }
  host = host.replace(/:\d+$/, '');
  path = path.replace(/\.git$/i, '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!host && !path) return null;
  return (path ? `${host}/${path}` : host).toLowerCase();
}

function identityOf(p: SyncProject): string | null {
  if (p && p.identity) return p.identity;
  const norm = normalizeGitRemote(p?.gitRemote);
  if (norm) return `git:${norm}`;
  if (p?.name) return `name:${p.name}`;
  return null;
}

function ts(s?: string | null): number {
  const t = Date.parse(s || '');
  return Number.isFinite(t) ? t : 0;
}

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

async function resolveGoogleId(env: any, deviceToken: string): Promise<{ googleId?: string; status?: number; error?: string }> {
  const raw = await env.LICENSES.get(`device:${deviceToken}`);
  if (!raw) return { status: 404, error: 'Device not found' };
  const device = JSON.parse(raw);
  if (!device.googleId) return { status: 400, error: 'No Google account linked' };
  return { googleId: device.googleId };
}

/**
 * GET /api/device/workspaces — Pull the user's synced project list.
 * Returns { projects: [], updatedAt: null } when nothing has ever been pushed
 * (desktop seeds on the first pull when updatedAt is null).
 */
export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  const auth = context.request.headers.get('Authorization');
  const deviceToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!deviceToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const resolved = await resolveGoogleId(env, deviceToken);
  if (!resolved.googleId) {
    return new Response(JSON.stringify({ error: resolved.error }), { status: resolved.status!, headers });
  }

  const dataRaw = await env.LICENSES.get(`workspaces:${resolved.googleId}`);
  if (!dataRaw) {
    return new Response(JSON.stringify({ projects: [], updatedAt: null }), { status: 200, headers });
  }

  const data = JSON.parse(dataRaw);
  return new Response(JSON.stringify({
    projects: Array.isArray(data.projects) ? data.projects : [],
    deleted: data.deleted && typeof data.deleted === 'object' ? data.deleted : {},
    updatedAt: data.updatedAt || null,
  }), { status: 200, headers });
};

/**
 * POST /api/device/workspaces — Push the user's synced project list.
 * Body: { projects: SyncProject[], pushedAt?: string }
 */
export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  const auth = context.request.headers.get('Authorization');
  const deviceToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!deviceToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const resolved = await resolveGoogleId(env, deviceToken);
  if (!resolved.googleId) {
    return new Response(JSON.stringify({ error: resolved.error }), { status: resolved.status!, headers });
  }

  let body: { projects?: SyncProject[]; deleted?: Tombstone[]; pushedAt?: string } = {};
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const incoming = Array.isArray(body.projects) ? body.projects : [];
  if (incoming.length > MAX_PROJECTS) {
    return new Response(JSON.stringify({ error: 'Too many projects', maxProjects: MAX_PROJECTS }), { status: 413, headers });
  }

  // ── Union-merge with the stored doc (per account), NOT replace ──────────────
  // The cloud must hold the UNION of every device's cloudSync projects. Each push
  // carries only the pushing device's set, so a plain replace would drop the other
  // machines' unique projects. Merge by stable identity, last-write-wins per
  // project (metadataUpdatedAt), and apply explicit tombstones for real removals.
  const prevRaw = await env.LICENSES.get(`workspaces:${resolved.googleId}`);
  const prev = prevRaw ? JSON.parse(prevRaw) : { projects: [], deleted: {} };
  const byId = new Map<string, SyncProject>();
  for (const p of (Array.isArray(prev.projects) ? prev.projects : [])) {
    const id = identityOf(p);
    if (id) byId.set(id, p);
  }
  const deleted: Record<string, string> = (prev.deleted && typeof prev.deleted === 'object') ? { ...prev.deleted } : {};

  // Incoming projects: LWW by metadataUpdatedAt; a project newer than its tombstone revives.
  for (const p of incoming) {
    const id = identityOf(p);
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing || ts(p.metadataUpdatedAt) >= ts(existing.metadataUpdatedAt)) byId.set(id, p);
    if (deleted[id] && ts(p.metadataUpdatedAt) > ts(deleted[id])) delete deleted[id];
  }

  // Incoming tombstones: remove the project iff the tombstone is at least as new
  // as the project's own metadataUpdatedAt (so a concurrent newer edit wins).
  const incomingDeleted = Array.isArray(body.deleted) ? body.deleted : [];
  for (const t of incomingDeleted) {
    const id = t && t.identity;
    if (!id) continue;
    const dAt = t.deletedAt || new Date().toISOString();
    const cur = byId.get(id);
    if (!cur || ts(dAt) >= ts(cur.metadataUpdatedAt)) {
      byId.delete(id);
      if (ts(dAt) > ts(deleted[id])) deleted[id] = dAt;
    }
  }

  // Cap the tombstone map (keep the most recent) so it can't grow unbounded.
  let mergedDeleted = deleted;
  const delKeys = Object.keys(deleted);
  if (delKeys.length > MAX_TOMBSTONES) {
    mergedDeleted = {};
    for (const k of delKeys.sort((a, b) => ts(deleted[b]) - ts(deleted[a])).slice(0, MAX_TOMBSTONES)) {
      mergedDeleted[k] = deleted[k];
    }
  }

  const mergedProjects = [...byId.values()];
  if (mergedProjects.length > MAX_PROJECTS) {
    return new Response(JSON.stringify({ error: 'Too many projects', maxProjects: MAX_PROJECTS }), { status: 413, headers });
  }

  const payload = JSON.stringify({
    version: 1,
    projects: mergedProjects,
    deleted: mergedDeleted,
    updatedAt: body.pushedAt || new Date().toISOString(),
  });
  if (new TextEncoder().encode(payload).length > MAX_BYTES) {
    return new Response(JSON.stringify({ error: 'Payload too large', maxBytes: MAX_BYTES }), { status: 413, headers });
  }

  await env.LICENSES.put(`workspaces:${resolved.googleId}`, payload);

  return new Response(JSON.stringify({ ok: true, count: mergedProjects.length }), { status: 200, headers });
};
