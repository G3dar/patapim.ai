---
title: "MCP Browser Control"
description: "Let Claude control a browser via MCP"
order: 8
---

## Overview

PATAPIM embeds browser panels using Electron's **WebContentsView** API with **Chrome DevTools Protocol (CDP)**. An MCP server lets Claude Code automate browser interactions.

## MCP Server

Stdio-based MCP server auto-registered in `~/.claude.json` on startup. Also registers for Codex and Gemini CLI.

### Available Tools

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to URL |
| `browser_click` | Click element by selector or text |
| `browser_fill` | Fill input fields |
| `browser_screenshot` | Capture screenshot |
| `browser_scroll` | Scroll page |
| `browser_wait` | Wait for elements |
| `browser_press_key` | Send key presses |
| `browser_evaluate` | Execute JavaScript |

## Device Emulation

Emulate devices: iPhone, iPad, Android, desktop. Uses Chromium's native device emulation.

## Limits

- Maximum **10 concurrent** MCP browsers with idle cleanup
- Authentication via `X-PATAPIM-TOKEN` header
- Downloads saved to `~/.patapim/downloads/`

## Security

Sandboxed web preferences with `contextIsolation` enabled and `nodeIntegration` disabled. Popup handling for OAuth flows (Google, Firebase).
