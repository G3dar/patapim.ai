import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../../../lib/cors';
import {
  plan, json, runKey, resultKey, sectionOf,
  mergeSectionResults, computeCounts, truncate,
  VALID_STATUSES, MAX_NOTE, MAX_EVIDENCE, MAX_BATCH, MAX_NAME,
  type RunMeta, type SectionResults, type ItemResult,
} from '../../../../../lib/deepTest';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

/**
 * POST /api/deep-test/runs/:runId/results
 * Body: { by?, results: [{ itemId, status, note?, evidence?, at? }] }
 * Batch-upserts item results: groups by section, merges per item by `at`
 * timestamp (newest wins), rewrites the touched section blobs, recomputes
 * the run's denormalized counts. Unknown itemIds are reported, not fatal.
 */
export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const runId = context.params.runId as string;

  const rawRun = await env.DEEP_TESTS.get(runKey(runId));
  if (!rawRun) return json({ error: 'Run not found' }, 404, cors);
  const run = JSON.parse(rawRun) as RunMeta;

  let body: any;
  try { body = await context.request.json(); } catch {
    return json({ error: 'Invalid JSON' }, 400, cors);
  }
  if (!Array.isArray(body.results) || body.results.length === 0) {
    return json({ error: 'results array required' }, 400, cors);
  }
  if (body.results.length > MAX_BATCH) {
    return json({ error: `Max ${MAX_BATCH} results per batch` }, 413, cors);
  }
  const by = typeof body.by === 'string' ? body.by.trim().slice(0, MAX_NAME) : undefined;

  // Group valid entries by section
  const bySection = new Map<string, Record<string, ItemResult>>();
  const ignored: string[] = [];
  for (const r of body.results) {
    if (!r || typeof r.itemId !== 'string') continue;
    const sectionId = sectionOf(r.itemId);
    if (!sectionId) { ignored.push(r.itemId); continue; }
    // status null/undefined clears the result? No — keep it simple: only valid statuses are stored.
    if (!VALID_STATUSES.includes(r.status)) { ignored.push(r.itemId); continue; }
    const entry: ItemResult = {
      s: r.status,
      at: typeof r.at === 'number' ? r.at : Date.now(),
      ...(by ? { by } : {}),
      ...(typeof r.note === 'string' && r.note ? { note: truncate(r.note, MAX_NOTE) } : {}),
      ...(typeof r.evidence === 'string' && r.evidence ? { ev: truncate(r.evidence, MAX_EVIDENCE) } : {}),
    };
    let group = bySection.get(sectionId);
    if (!group) { group = {}; bySection.set(sectionId, group); }
    group[r.itemId] = entry;
  }
  if (bySection.size === 0) return json({ error: 'No valid results', ignored }, 400, cors);

  // Read-merge-write each touched section
  for (const [sectionId, incoming] of bySection) {
    const key = resultKey(runId, sectionId);
    const raw = await env.DEEP_TESTS.get(key);
    const existing: SectionResults | null = raw ? JSON.parse(raw) : null;
    await env.DEEP_TESTS.put(key, JSON.stringify(mergeSectionResults(existing, incoming)));
  }

  // Recompute counts from all section blobs
  const blobs = await Promise.all(plan.sections.map(s => env.DEEP_TESTS.get(resultKey(runId, s.id))));
  const sections = blobs.filter(Boolean).map(b => JSON.parse(b!) as SectionResults);
  run.counts = computeCounts(sections);
  run.updatedAt = new Date().toISOString();
  await env.DEEP_TESTS.put(runKey(runId), JSON.stringify(run));

  return json({ ok: true, counts: run.counts, ...(ignored.length ? { ignored } : {}) }, 200, cors);
};
