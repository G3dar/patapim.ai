// Shared types + KV helpers for the 3DAR subdomain-request approval flow.
//
// Flow: a 3DAR employee POSTs a subdomain request (authenticated with a
// create-only "team token"); patapim.ai emails the team owner an approval
// link; the owner approves on a web page; patapim.ai pushes the approved task
// down to the owner's PATAPIM desktop via the Telegram-relay Durable Object,
// which runs deploy-sub.sh locally. All keys live in the LICENSES KV namespace.

// A subdomain label: 1-40 chars, lowercase alphanumeric + hyphen, no leading
// or trailing hyphen. Validated identically on the employee script, here, and
// again on the desktop runner — defence in depth, never trust one layer.
export const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;
// GitHub username (1-39 chars, alphanumeric + hyphen, no leading/trailing).
export const GH_USER_RE = /^[A-Za-z0-9]([A-Za-z0-9-]{0,38}[A-Za-z0-9])?$/;
// "owner/name" — minimal sanity check; GitHub itself rejects bad names.
export const GH_REPO_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

export type SubReqStatus =
  | 'pending' // created, waiting for the owner to decide
  | 'approved' // owner approved, task dispatched to their desktop
  | 'running' // desktop acked and started deploy-sub.sh
  | 'done' // desktop finished successfully
  | 'failed' // desktop run failed
  | 'rejected'; // owner rejected

export interface TeamRecord {
  ownerGoogleId: string;
  ownerEmail: string;
  ownerInstanceId: string; // the owner's paired Telegram instance_id
  label: string;
  createdAt: string;
}

export interface SubReqResult {
  exitCode?: number;
  log?: string;
  repoUrl?: string;
  pagesUrl?: string;
  domainUrl?: string;
}

export interface SubReq {
  id: string;
  subdomain: string;
  ownerGoogleId: string;
  ownerInstanceId: string;
  callbackSecret: string; // one-time secret the desktop uses for /result
  requesterName: string;
  // GitHub username of the requester. The desktop adds them as a push
  // collaborator on the repo (new or existing) so they can actually push code.
  requesterGithub: string | null;
  // If set ("owner/name"), the desktop attaches the subdomain to this EXISTING
  // GitHub repo instead of creating G3dar/<subdomain> fresh.
  existingRepo: string | null;
  status: SubReqStatus;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null; // googleId of the approver
  dispatchedAt: string | null;
  finishedAt: string | null;
  result: SubReqResult | null;
  error: string | null;
}

const SUBREQ_TTL = 7 * 24 * 3600; // 7 days
const DEDUPE_TTL = 3600; // 1 hour

export function teamKey(token: string): string {
  return `team:${token}`;
}
export function subreqKey(id: string): string {
  return `subreq:${id}`;
}
export function dedupeKey(ownerGoogleId: string, subdomain: string): string {
  return `subreq:pending:${ownerGoogleId}:${subdomain}`;
}

export async function loadTeam(licenses: KVNamespace, token: string): Promise<TeamRecord | null> {
  if (!token) return null;
  const raw = await licenses.get(teamKey(token));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TeamRecord;
  } catch {
    return null;
  }
}

export async function loadSubReq(licenses: KVNamespace, id: string): Promise<SubReq | null> {
  if (!id) return null;
  const raw = await licenses.get(subreqKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SubReq;
  } catch {
    return null;
  }
}

// Re-putting refreshes the 7-day TTL — fine; an actively-progressing request
// should stay alive while it moves through its states.
export async function saveSubReq(licenses: KVNamespace, subreq: SubReq): Promise<void> {
  await licenses.put(subreqKey(subreq.id), JSON.stringify(subreq), { expirationTtl: SUBREQ_TTL });
}

export async function setDedupe(
  licenses: KVNamespace,
  ownerGoogleId: string,
  subdomain: string,
  id: string,
): Promise<void> {
  await licenses.put(dedupeKey(ownerGoogleId, subdomain), id, { expirationTtl: DEDUPE_TTL });
}
export async function getDedupe(
  licenses: KVNamespace,
  ownerGoogleId: string,
  subdomain: string,
): Promise<string | null> {
  return licenses.get(dedupeKey(ownerGoogleId, subdomain));
}
export async function clearDedupe(
  licenses: KVNamespace,
  ownerGoogleId: string,
  subdomain: string,
): Promise<void> {
  await licenses.delete(dedupeKey(ownerGoogleId, subdomain));
}

// Strip the secret before returning a SubReq to any client. The callbackSecret
// must only ever travel inside the task envelope pushed to the desktop.
export function publicSubReq(s: SubReq): Omit<SubReq, 'callbackSecret'> {
  const { callbackSecret: _omit, ...rest } = s;
  return rest;
}

// The structured task pushed to the desktop. Deliberately NOT a shell string —
// the desktop maps `kind` to a fixed local script and the only wire-supplied
// value it ever uses is `subdomain`, re-validated against SUBDOMAIN_RE.
export interface TeamTaskEnvelope {
  kind: 'create_subdomain';
  requestId: string;
  subdomain: string;
  callbackSecret: string;
  callbackUrl: string;
  // Optional — present only when the requester or owner specified them.
  requesterGithub?: string;
  existingRepo?: string;
}

// Push an approved task to the owner's PATAPIM desktop via the Telegram-relay
// Durable Object. Returns whether it was delivered to a live socket (false =
// queued for the next reconnect, or the DO endpoint isn't deployed yet). Never
// throws — a dispatch failure must not fail the approval; the desktop also
// flushes the DO command queue on reconnect.
export async function dispatchTeamTask(
  env: Env,
  instanceId: string,
  task: TeamTaskEnvelope,
): Promise<{ delivered: boolean }> {
  try {
    const stub = env.TELEGRAM_INSTANCE.get(env.TELEGRAM_INSTANCE.idFromName(instanceId));
    const res = await stub.fetch('https://do/__internal/send-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: task }),
    });
    if (!res.ok) {
      console.error('dispatchTeamTask: DO returned', res.status);
      return { delivered: false };
    }
    const body = (await res.json().catch(() => ({}))) as { delivered?: boolean };
    return { delivered: !!body.delivered };
  } catch (e) {
    console.error('dispatchTeamTask failed:', e);
    return { delivered: false };
  }
}
