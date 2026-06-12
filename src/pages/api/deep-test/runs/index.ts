import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../../lib/cors';
import { listAllKeys, fetchAllValues } from '../../../../lib/admin';
import {
  plan, json, newRunId, runKey,
  MAX_NAME, MAX_RUNS,
  type RunMeta,
} from '../../../../lib/deepTest';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

/** GET /api/deep-test/runs — list all runs, newest first. */
export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const keys = await listAllKeys(env.DEEP_TESTS, 'run:');
  const values = await fetchAllValues<RunMeta>(env.DEEP_TESTS, keys.map(k => k.name));
  const runs = [...values.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return json({ runs, planVersion: plan.planVersion }, 200, cors);
};

/** POST /api/deep-test/runs — create a run. {name, label?, environment, appVersion?, kind} */
export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);

  let body: any;
  try { body = await context.request.json(); } catch {
    return json({ error: 'Invalid JSON' }, 400, cors);
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME) : '';
  if (!name) return json({ error: 'name is required' }, 400, cors);
  const kind = body.kind === 'agent' ? 'agent' : 'human';
  const environment = typeof body.environment === 'string' ? body.environment.trim().slice(0, MAX_NAME) : 'unspecified';

  const existing = await listAllKeys(env.DEEP_TESTS, 'run:');
  if (existing.length >= MAX_RUNS) return json({ error: 'Run limit reached' }, 429, cors);

  const now = new Date().toISOString();
  const run: RunMeta = {
    runId: newRunId(),
    name,
    label: typeof body.label === 'string' ? body.label.trim().slice(0, MAX_NAME) : undefined,
    environment,
    kind,
    planVersion: plan.planVersion,
    appVersion: typeof body.appVersion === 'string' ? body.appVersion.slice(0, 40) : undefined,
    createdAt: now,
    updatedAt: now,
    status: 'active',
    counts: { pass: 0, fail: 0, blocked: 0, skipped: 0, untested: plan.items.length, total: plan.items.length },
  };
  await env.DEEP_TESTS.put(runKey(run.runId), JSON.stringify(run));
  return json({ runId: run.runId, planVersion: plan.planVersion, run }, 200, cors);
};
