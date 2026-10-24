---
title: "Local API"
description: "Control and automate PATAPIM from your own scripts over a local HTTP + WebSocket API"
order: 1
---

## Overview

PATAPIM runs a local **HTTP + WebSocket API** on `http://127.0.0.1:31415` — the same API its built-in MCP server uses. Any script or tool on your machine can drive PATAPIM through it: create terminals, send prompts to an AI CLI, read output, manage tasks, send notifications, and drive the embedded browser.

The API is **off by default**. Turn it on in **Preferences → Local API**, then create a token.

## Tokens & scopes

Every request needs a scoped token (`ppat_…`), created in **Preferences → Local API → Create token**. The token is shown once — store it like a password. Pass it in the `x-patapim-token` header (or `Authorization: Bearer`).

Each token carries only the scopes you check at creation time:

| Scope | Grants |
|-------|--------|
| `terminals:read` | List terminals, read buffers and live state |
| `terminals:write` | Create terminals, send input, resize, close |
| `tasks` | Read/manage project tasks and scheduled commands |
| `notifications` | Send notifications through your configured channels |
| `browser` | Drive the embedded browser (navigate, click, fill, screenshot) |
| `files:read` | Read files in project directories |
| `files:write` | Write files in project directories |
| `events` | Subscribe to the WebSocket event stream |

## Quick start

```bash
# What can this token do?
curl http://127.0.0.1:31415/api/v1/meta -H "x-patapim-token: ppat_..."

# List terminals (scope: terminals:read)
curl http://127.0.0.1:31415/api/v1/terminals -H "x-patapim-token: ppat_..."

# Send a prompt to terminal 3 (scope: terminals:write)
curl -X POST http://127.0.0.1:31415/api/v1/terminals/3/write \
  -H "x-patapim-token: ppat_..." -H "Content-Type: application/json" \
  -d '{"data": "Summarize the failing tests", "pressEnter": true}'
```

## Event stream

Connect a WebSocket to `ws://127.0.0.1:31415?token=ppat_...` (token needs the `events` scope) and subscribe to topics — `terminals`, `terminal-output:<id>`, `tasks`, `notifications`. The `notifications` topic fires exactly when PATAPIM raises its own bell/toast, which makes it ideal for routing "Claude needs attention" to Slack, Discord, or anywhere.

## Versioning & safety

- Everything lives under **`/api/v1`** and is **additive-only**: routes, parameters and response fields are never removed or renamed.
- Plan limits (e.g. the free-tier terminal cap) are enforced regardless of how a request originates — the API never bypasses them.
- The full machine-readable spec is published as an OpenAPI document in the [SDK repo](https://github.com/G3dar/patapim-sdk).

Next: the [TypeScript SDK](/docs/extensibility/sdk) wraps all of this in a typed client.
