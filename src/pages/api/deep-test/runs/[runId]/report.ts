import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../../../lib/cors';
import {
  plan, json, runKey, reportKey, MAX_NAME,
  type RunMeta, type Report,
} from '../../../../../lib/deepTest';

export const prerender = false;

const MAX_REPORT = 200_000; // ~200KB of markdown is plenty

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

/** GET /api/deep-test/runs/:runId/report */
export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const runId = context.params.runId as string;
  const raw = await env.DEEP_TESTS.get(reportKey(runId));
  if (!raw) return json({ error: 'No report for this run' }, 404, cors);
  return json(JSON.parse(raw), 200, cors);
};

/** POST /api/deep-test/runs/:runId/report — {markdown, by?}; marks run complete. */
export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const runId = context.params.runId as string;

  const rawRun = await env.DEEP_TESTS.get(runKey(runId));
  if (!rawRun) return json({ error: 'Run not found' }, 404, cors);

  let body: any;
  try { body = await context.request.json(); } catch {
    return json({ error: 'Invalid JSON' }, 400, cors);
  }
  if (typeof body.markdown !== 'string' || body.markdown.trim().length < 20) {
    return json({ error: 'markdown (≥20 chars) required' }, 400, cors);
  }
  if (body.markdown.length > MAX_REPORT) {
    return json({ error: 'Report too large' }, 413, cors);
  }

  const report: Report = {
    markdown: body.markdown,
    createdAt: new Date().toISOString(),
    by: typeof body.by === 'string' ? body.by.trim().slice(0, MAX_NAME) : undefined,
    planVersion: plan.planVersion,
  };
  await env.DEEP_TESTS.put(reportKey(runId), JSON.stringify(report));

  const run = JSON.parse(rawRun) as RunMeta;
  run.status = 'complete';
  run.updatedAt = report.createdAt;
  await env.DEEP_TESTS.put(runKey(runId), JSON.stringify(run));

  return json({ ok: true }, 200, cors);
};
