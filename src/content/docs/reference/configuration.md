---
title: "Configuration"
description: "PATAPIM configuration options"
order: 2
---

## Global Configuration Directory

All PATAPIM configuration is stored at `~/.patapim/`:

| File | Purpose |
|------|---------|
| `workspaces.json` | Project list, active workspace, and project metadata |
| `sessions.json` | Terminal sessions, working directories, and state per project |
| `account.json` | Auth token, email address, and license tier |
| `passkeys.json` | WebAuthn/PassKey credentials for remote access |
| `trusted-passkeys.json` | Whitelist of trusted PassKeys for remote authentication |
| `downloads/` | Files downloaded by embedded browser panels |
| `mcp-token` | MCP server authentication token (production) |
| `mcp-token-dev` | MCP server authentication token (dev instance) |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PATAPIM_INSTANCE=dev` | Run as dev instance (isolates CDP port to 9223, uses separate userData directory `PATAPIM-dev/`) | Not set |
| `PATAPIM_DEBUG=1` | Open Electron DevTools on startup | Not set |
| `PATAPIM_PORT` | Override remote access server port | `31415` |
| `PATAPIM_MCP_TOKEN` | MCP server authentication token (also synced to `~/.patapim/mcp-token` file) | Auto-generated |
| `PATAPIM_TERMINAL_ID` | Terminal ID for MCP server — set by the remote server to link browser to terminal | Auto-set |

## Per-Project Configuration

Each project can have a `.patapim/config.json` in its root for project-specific settings.

## Runtime Settings

PATAPIM stores UI preferences in the Electron renderer's localStorage:

- Window size and position
- Active terminal and tab state
- Panel visibility preferences
- Voice dictation provider selection
- Grid layout preference

These settings persist across app restarts but are tied to the Electron app data directory.

## Multi-Instance (Dev Mode)

You can run two PATAPIM instances simultaneously:

| Property | Stable | Dev |
|----------|--------|-----|
| CDP Port | 9222 | 9223 |
| userData | `PATAPIM/` | `PATAPIM-dev/` |
| Window Title | `PATAPIM` | `PATAPIM [DEV]` |
| Logo Color | Default | Amber |
| PID File | — | `%APPDATA%/PATAPIM-dev/patapim-dev.pid` |

Start a dev instance with `PATAPIM_INSTANCE=dev npm start`.
