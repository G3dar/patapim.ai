import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../../../lib/cors';
import {
  plan, json, runKey, resultKey, MAX_NAME,
  type RunMeta, type SectionResults,
} from '../../../../../lib/deepTest';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

/** GET /api/deep-test/runs/:runId — run meta + all section results. */
export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const runId = context.params.runId as string;

  const raw = await env.DEEP_TESTS.get(runKey(runId));
  if (!raw) return json({ error: 'Run not found' }, 404, cors);
  const run = JSON.parse(raw) as RunMeta;

  const sectionIds = plan.sections.map(s => s.id);
  const blobs = await Promise.all(sectionIds.map(id => env.DEEP_TESTS.get(resultKey(runId, id))));
  const results: Record<string, SectionResults> = {};
  sectionIds.forEach((id, i) => {
    if (blobs[i]) { try { results[id] = JSON.parse(blobs[i]!); } catch { /* skip */ } }
  });

  return json({ run, results }, 200, cors);
};

/** POST /api/deep-test/runs/:runId — update meta: {status?, label?, appVersion?} */
export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const runId = context.params.runId as string;

  const raw = await env.DEEP_TESTS.get(runKey(runId));
  if (!raw) return json({ error: 'Run not found' }, 404, cors);
  const run = JSON.parse(raw) as RunMeta;

  let body: any;
  try { body = await context.request.json(); } catch {
    return json({ error: 'Invalid JSON' }, 400, cors);
  }

  if (['active', 'complete', 'abandoned'].includes(body.status)) run.status = body.status;
  if (typeof body.label === 'string') run.label = body.label.trim().slice(0, MAX_NAME);
  if (typeof body.appVersion === 'string') run.appVersion = body.appVersion.slice(0, 40);
  run.updatedAt = new Date().toISOString();

  await env.DEEP_TESTS.put(runKey(runId), JSON.stringify(run));
  return json({ run }, 200, cors);
};
