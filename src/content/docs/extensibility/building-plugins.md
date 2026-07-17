---
title: "Building Plugins"
description: "Write a PATAPIM plugin: MCP tools, commands, panels, toolbar buttons, scheduled tasks and instruction blocks"
order: 3
---

## Overview

A PATAPIM plugin is a folder in `~/.patapim/plugins/<name>/` that runs **isolated** from the app, with a token scoped to exactly the permissions you approve. The headline capability: **a plugin can register MCP tools that appear in every Claude Code / Codex session** running inside PATAPIM — automatically, no per-session setup.

> This is distinct from Claude Code's own plugins (`~/.claude/plugins/`). See the [Plugin System](/docs/features/plugin-system) overview for the difference.

## Anatomy

```
~/.patapim/plugins/my-plugin/
  plugin.json      # manifest
  index.js         # entry module (CommonJS)
```

`plugin.json`:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What it does",
  "main": "index.js",
  "permissions": ["terminals:read", "notifications"],
  "contributes": {
    "instructionBlocks": [{ "text": "This project uses pnpm, not npm." }],
    "commands": [{ "id": "sync", "title": "Sync now" }],
    "scheduledTasks": [{ "command": "sync", "cron": "*/30 * * * *" }]
  }
}
```

- `permissions` are [Local API scopes](/docs/extensibility/local-api) — exactly what the plugin's token carries. The user approves them when enabling the plugin, browser-extension style.

## The entry module

```js
module.exports.activate = async (patapim) => {
  // Becomes `plugin_my-plugin_summarize` in every AI CLI session
  patapim.registerMcpTool({
    name: 'summarize',
    description: 'Summarize the state of all open terminals',
    inputSchema: { type: 'object', properties: {} },
  }, async () => {
    const { terminals } = await patapim.get('/terminals');
    return terminals.map(t => ({ id: t.terminalId, busy: t.isProcessing }));
  });

  patapim.registerCommand('sync', async () => { /* ... */ return 'synced'; });
};

module.exports.deactivate = async () => { /* optional cleanup */ };
```

## Contribution points

| Contribution | What it does |
|--------------|--------------|
| **MCP tools** | `registerMcpTool` — available to Claude Code / Codex as `plugin_<name>_<tool>` |
| **Commands** | Buttons on the plugin's card that dispatch to your handler |
| **Toolbar buttons** | Buttons in the terminal toolbar bound to a command |
| **Panels** | A sandboxed UI window (`panel.html`) talking to the Local API |
| **Instruction blocks** | Standing context injected into the AI memory files while enabled |
| **Scheduled tasks** | Fire a command on a cron schedule while the plugin runs |

## Security model

Each enabled plugin runs in its own isolated process with **no Electron, renderer or app-internals access** — its only capability is the Local API with a token scoped to the granted permissions. Everything lives under `~/.patapim`, so plugins survive app updates.

## Full guide

The complete reference — the `patapim` host API, panels, the exact runtime contract, and a working `hello-world` example — lives in the SDK repo: **[docs/plugins.md](https://github.com/G3dar/patapim-sdk/blob/main/docs/plugins.md)**.
