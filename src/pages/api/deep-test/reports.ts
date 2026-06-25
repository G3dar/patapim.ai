import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';
import { listAllKeys, fetchAllValues } from '../../../lib/admin';
import { json, runKey, type RunMeta, type Report } from '../../../lib/deepTest';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

/** GET /api/deep-test/reports — runs that have a final report, newest first. */
export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);

  const reportKeys = await listAllKeys(env.DEEP_TESTS, 'report:');
  const runIds = reportKeys.map(k => k.name.slice('report:'.length));
  const runs = await fetchAllValues<RunMeta>(env.DEEP_TESTS, runIds.map(runKey));
  const reports = await fetchAllValues<Report>(env.DEEP_TESTS, reportKeys.map(k => k.name));

  const entries = runIds.map(runId => {
    const run = runs.get(runKey(runId));
    const report = reports.get(`report:${runId}`);
    return {
      runId,
      name: run?.name || '(unknown)',
      label: run?.label,
      environment: run?.environment,
      kind: run?.kind,
      counts: run?.counts,
      createdAt: report?.createdAt || run?.updatedAt || '',
      planVersion: report?.planVersion,
    };
  }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  return json({ reports: entries }, 200, cors);
};
