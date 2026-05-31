import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

const MAX_BYTES = 256 * 1024;
const MAX_PROJECTS = 500;

type SyncProject = {
  name: string;
  isPatapimProject?: boolean;
  addedAt?: string | null;
  metadataUpdatedAt?: string | null;
  archived?: boolean;
  order?: number;
  cloudSync?: boolean;
  autoGitSync?: boolean;
  gitRemote?: string;
  subfolders?: Array<{ name: string; gitMode?: string; order?: number }>;
};

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

  let body: { projects?: SyncProject[]; pushedAt?: string } = {};
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const projects = Array.isArray(body.projects) ? body.projects : [];
  if (projects.length > MAX_PROJECTS) {
    return new Response(JSON.stringify({ error: 'Too many projects', maxProjects: MAX_PROJECTS }), { status: 413, headers });
  }

  const payload = JSON.stringify({
    version: 1,
    projects,
    updatedAt: body.pushedAt || new Date().toISOString(),
  });
  if (new TextEncoder().encode(payload).length > MAX_BYTES) {
    return new Response(JSON.stringify({ error: 'Payload too large', maxBytes: MAX_BYTES }), { status: 413, headers });
  }

  await env.LICENSES.put(`workspaces:${resolved.googleId}`, payload);

  return new Response(JSON.stringify({ ok: true, count: projects.length }), { status: 200, headers });
};
