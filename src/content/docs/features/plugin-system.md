---
title: "Plugin System"
description: "Extend PATAPIM with plugins"
order: 7
---

## Overview

PATAPIM works with **two** kinds of plugins:

1. **Claude Code plugins** — PATAPIM surfaces Claude Code's own plugin ecosystem (read from `~/.claude/plugins/`), so you can browse, toggle and favorite them from Preferences.
2. **PATAPIM plugins** — plugins that extend PATAPIM *itself*: they run isolated with a scoped token and can add MCP tools to every AI session, UI panels, toolbar buttons, scheduled tasks and more. This is PATAPIM's own extensibility layer.

## Claude Code plugins

Open **Preferences** (`Ctrl+,`):

- Browse the marketplace
- Toggle plugins on/off
- Mark favorites
- Settings stored in `~/.claude/settings.json`

Changes sync between PATAPIM and Claude Code.

## PATAPIM plugins

These live in `~/.patapim/plugins/`, are managed under **Preferences → Local API**, and are built on PATAPIM's [Local API](/docs/extensibility/local-api). The standout capability: a plugin's tools appear automatically in every Claude Code / Codex session as MCP tools.

- [Building Plugins](/docs/extensibility/building-plugins) — write your own
- [Plugin Marketplace](/docs/extensibility/marketplace) — browse, install and publish
- [Local API](/docs/extensibility/local-api) & [TypeScript SDK](/docs/extensibility/sdk) — the foundation they build on
