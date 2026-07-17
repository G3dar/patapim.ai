---
title: "TypeScript SDK"
description: "@patapim/sdk — a typed client for the Local API (HTTP + events)"
order: 2
---

## Overview

**[`@patapim/sdk`](https://www.npmjs.com/package/@patapim/sdk)** is a zero-dependency TypeScript client for PATAPIM's [Local API](/docs/extensibility/local-api). It wraps every endpoint and the WebSocket event stream in a typed, ergonomic client.

```bash
npm install @patapim/sdk
```

## Usage

```ts
import { PatapimClient } from '@patapim/sdk';

const patapim = new PatapimClient({ token: process.env.PATAPIM_TOKEN! });

// Send a prompt to terminal 3
await patapim.terminals.write('3', 'Fix the failing tests', true);

// Read a project's tasks
const { tasks } = await patapim.tasks.list('C:/Users/me/my-project');

// React to events
const events = await patapim.events(['notifications', 'tasks']);
events.on('notifications', (e) => console.log('terminal needs attention:', e.terminalId));
```

## What you can build

- **CI / automation hooks** — create tasks, kick off prompts, read terminal output from any script.
- **Custom notification routing** — subscribe to the event stream and forward "Claude finished / needs input" to Slack, Discord, ntfy, a smart bulb…
- **Dashboards & monitors** — live terminal state (processing / plan mode / attention) over HTTP.
- **Browser automation** — drive PATAPIM's embedded browser.

## Source, examples & spec

Everything is open-source (MIT) at **[github.com/G3dar/patapim-sdk](https://github.com/G3dar/patapim-sdk)**:

- `packages/sdk` — the client
- `openapi/openapi.json` — the full API spec, generated from the app on every release
- `examples/` — runnable scripts (post a task from CI, prompt a terminal, a notification router)
- `docs/` — authentication, scopes, events, versioning
