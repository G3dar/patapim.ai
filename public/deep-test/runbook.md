# PATAPIM Deep Test — Claude Tester Runbook

You are an external Claude Code instance tasked with executing the PATAPIM deep-test
plan against a running PATAPIM installation, recording results to the Deep Test site,
and filing a final report. Work methodically, section by section. You are expected to
take a long time — completeness beats speed.

Plan v1.0.0: **982 items across 20 sections** — 869 are agent-testable (`mode` is
`"agent"` or `"both"`), 115 are flagged `destructive` (skip unless authorized). The
two `mcp-tools-*` sections (131 items) are pure MCP calls — the natural warm-up.

## 0. Mission rules

- **Non-destructive by default.** Skip items marked `destructive: true` unless the run
  was explicitly authorized for them (ask the operator if unsure).
- Test the instance you were pointed at (stable port **31415** / dev port **31416**).
  Never assume — verify with `app_info` which instance and version you are driving.
- Prefix anything you create (projects, terminals, tasks, files) with `__patapim_e2e__`
  and clean up at the end.
- Never touch the operator's real projects, accounts, or messaging contacts.

## 1. Prerequisites

- PATAPIM is running on this machine.
- You have the `patapim-browser` MCP server connected. If not:

```bash
# Source checkout:
claude mcp add patapim-browser -- node C:/Users/<you>/patapim/src/mcp/patapim-browser-server.js
# Packaged install:
claude mcp add patapim-browser -- node "<install dir>/resources/app.asar.unpacked/src/mcp/patapim-browser-server.js"
```

- Target instance selection: set `PATAPIM_PORT=31415` (stable) or `31416` (dev) in the
  MCP server env. Auth token is read automatically from `~/.patapim/mcp-token` (stable)
  or `~/.patapim/mcp-token-dev` (dev) on every request.
- Verify the connection: call `app_wait_ready`, then `app_info` — record `version` and
  `instance` for your run metadata.
- For native-input items (`computer_*` tools): Computer Control must be enabled in
  PATAPIM Preferences → Computer Control. If it's off and you cannot ask the operator,
  mark those items BLOCKED with reason "computer control disabled".

## 2. Claim a run

```bash
curl -X POST https://patapim.ai/api/deep-test/runs \
  -H "Content-Type: application/json" \
  -d '{"name":"Claude <context>","kind":"agent","environment":"<host stable|host dev|VM fresh install>","appVersion":"<from app_info>"}'
# → { "runId": "dt-...", "planVersion": "..." }
```

Fetch the plan and select your work list:

```bash
curl https://patapim.ai/api/deep-test/plan
```

- Take items where `mode` is `"agent"` or `"both"`.
- Order: P0 first, then P1, then P2, grouped by section in plan order.
- Items with `requiresExternal` (telegram/whatsapp/gmail/account/…): probe availability
  first (e.g. `gmail_status`, `whatsapp_status`); if the integration is not connected,
  mark `skipped` with note "integration not connected", don't attempt setup.

## 3. Execution playbook (per item)

Tool ladder — use the highest rung that works:

1. `ui_state` / `ui_click` / `ui_fill` — DOM-level, by selector (`automationHints.selectors`).
2. `app_evaluate` may be CSP-blocked; assert via `ui_state` + `app_screenshot` instead.
3. `computer_*` — ONLY for native menus, right-clicks, OS dialogs, tray, toasts.
   **Always take a fresh `computer_screenshot` immediately before any pixel-coordinate
   click** (`space:"image"` maps to the LAST screenshot taken).
4. `app_screenshot` for visual evidence; `app_logs` sweep after every item — any new
   console error belongs in the item's evidence.

Result semantics:
- `pass` — behavior matches `expected`.
- `fail` — app misbehaves. Retry ONCE before failing. Notes MUST include: what you did,
  what you expected, what happened, selector/coords used, relevant `app_logs` excerpt.
- `blocked` — the harness can't perform the test (occlusion, missing permission,
  feature requires human senses). Say why.
- `skipped` — deliberately not attempted (destructive without authorization, missing
  integration). Say why.

## 4. Record results incrementally

POST after every few items — never hold everything until the end:

```bash
curl -X POST https://patapim.ai/api/deep-test/runs/<runId>/results \
  -H "Content-Type: application/json" \
  -d '{"by":"Claude","results":[
    {"itemId":"terminals-001","status":"pass","note":"opened in 1.2s","evidence":"terminal_list shows id t-3 active"},
    {"itemId":"terminals-002","status":"fail","note":"expected X got Y","evidence":"app_logs: TypeError ..."}
  ]}'
```

- Batches of ≤25 results, at least ~5 seconds apart (KV write-rate friendliness).
- `status` ∈ `pass|fail|blocked|skipped`. `note` ≤4KB, `evidence` ≤8KB (text only).

## 5. Final report

When done (or out of time), compose a markdown report and file it — this marks the
run complete:

```bash
curl -X POST https://patapim.ai/api/deep-test/runs/<runId>/report \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# PATAPIM Deep Test — Claude ...","by":"Claude"}'
```

Report structure: header (run/instance/version/environment), totals line
(`N executed — P PASS · F FAIL · B BLOCKED · S SKIPPED`), **Failures** section (one
heading per fail: repro, expected vs actual, severity, log excerpt), **Blocked** list
with reasons, per-section results table, environment notes, cleanup confirmation.

## 6. Known pitfalls

- Window occlusion breaks screenshot-based assertions — bring the PATAPIM window to
  front first (`app_info` → if not focused, focus it via `computer_*` on its taskbar
  entry or `ui_*`).
- Two PATAPIM instances may run simultaneously (stable + dev) — pixel clicks can land
  on the wrong window. Verify with a fresh screenshot before and after.
- `app_evaluate` is CSP-blocked in current builds — don't rely on it; use `ui_*`.
- A benign "emergency stop" banner can appear if Ctrl+Alt+Shift+Esc was consumed —
  dismiss and continue.
- KV consistency: your posted results can take ~60s to appear for other viewers of
  the run. That's expected.
