/**
 * Deep Test — shared types, KV key builders and merge helpers.
 *
 * Storage model (KV namespace DEEP_TESTS):
 *   run:<runId>                → RunMeta (counts denormalized for the runs list)
 *   result:<runId>:<sectionId> → SectionResults (one blob per section so a human
 *                                and an agent writing the same run never clobber
 *                                each other; merge is per-item by `at` timestamp)
 *   report:<runId>             → Report (final markdown)
 *
 * The plan itself is NOT in KV — it's committed at src/data/deep-test-plan.json
 * and imported at build time; regenerating the plan means commit + redeploy.
 */

import planJson from '../data/deep-test-plan.json';

export interface PlanItem {
  id: string;
  section: string;
  subsection?: string;
  title: string;
  preconditions?: string[];
  steps?: string[];
  expected?: string;
  mode: 'human' | 'agent' | 'both';
  destructive?: boolean;
  requiresExternal?: string[];
  priority: 'P0' | 'P1' | 'P2';
  automationHints?: { selectors?: string[]; mcpTools?: string[]; notes?: string };
  sourceRefs?: string[];
  seedRef?: string;
  seedResult?: string;
}

export interface Plan {
  planVersion: string;
  generatedAt: string;
  appVersion: string;
  appCommit?: string;
  sections: { id: string; title: string; description?: string; order: number }[];
  items: PlanItem[];
}

export type ItemStatus = 'pass' | 'fail' | 'blocked' | 'skipped';

export interface ItemResult {
  s: ItemStatus;
  note?: string;
  ev?: string;       // textual evidence (logs, observed-vs-expected)
  at: number;        // client timestamp ms — newest wins on merge
  by?: string;       // tester name
}

export interface SectionResults {
  updatedAt: string;
  items: Record<string, ItemResult>;
}

export interface RunCounts {
  pass: number; fail: number; blocked: number; skipped: number;
  untested: number; total: number;
}

export interface RunMeta {
  runId: string;
  name: string;            // tester name
  label?: string;          // free-form run label
  environment: string;     // "VM fresh install" | "host stable" | custom
  kind: 'human' | 'agent';
  planVersion: string;
  appVersion?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'complete' | 'abandoned';
  counts: RunCounts;
}

export interface Report {
  markdown: string;
  createdAt: string;
  by?: string;
  planVersion: string;
}

export const plan = planJson as Plan;

// itemId → sectionId index, built once per isolate
const itemSection = new Map<string, string>();
for (const it of plan.items) itemSection.set(it.id, it.section);

export function sectionOf(itemId: string): string | undefined {
  return itemSection.get(itemId);
}

export const runKey = (runId: string) => `run:${runId}`;
export const resultKey = (runId: string, sectionId: string) => `result:${runId}:${sectionId}`;
export const reportKey = (runId: string) => `report:${runId}`;

export function newRunId(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `dt-${ymd}-${crypto.randomUUID().slice(0, 8)}`;
}

export const VALID_STATUSES: ItemStatus[] = ['pass', 'fail', 'blocked', 'skipped'];
export const MAX_NOTE = 4_000;
export const MAX_EVIDENCE = 8_000;
export const MAX_BATCH = 100;
export const MAX_NAME = 120;
export const MAX_RUNS = 1_000;

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + `\n[truncated ${s.length - max} chars]`;
}

/** Merge incoming item results into a section blob; newest `at` per item wins. */
export function mergeSectionResults(
  existing: SectionResults | null,
  incoming: Record<string, ItemResult>,
): SectionResults {
  const items = existing?.items ? { ...existing.items } : {};
  for (const [itemId, res] of Object.entries(incoming)) {
    const prev = items[itemId];
    if (!prev || (res.at || 0) >= (prev.at || 0)) items[itemId] = res;
  }
  return { updatedAt: new Date().toISOString(), items };
}

/** Recompute denormalized run counts from all section blobs. */
export function computeCounts(sections: SectionResults[]): RunCounts {
  const counts: RunCounts = { pass: 0, fail: 0, blocked: 0, skipped: 0, untested: 0, total: plan.items.length };
  let tested = 0;
  for (const sec of sections) {
    for (const r of Object.values(sec.items)) {
      if (r.s in counts) { (counts as any)[r.s]++; tested++; }
    }
  }
  counts.untested = Math.max(0, counts.total - tested);
  return counts;
}

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}
