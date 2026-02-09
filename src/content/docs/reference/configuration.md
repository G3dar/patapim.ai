---
title: "Configuration"
description: "PATAPIM configuration options"
order: 2
---

# Configuration

PATAPIM configuration is managed through multiple files and environment variables.

## Project-Level Configuration

### .patapim/config.json

Project-specific configuration stored in `.patapim/config.json` at the project root.

```json
{
  "projectName": "My Project",
  "defaultTerminalCount": 2,
  "historyFile": ".patapim/history.txt",
  "taskFile": "tasks.json"
}
```

**Location:** `<project-root>/.patapim/config.json`

**Common Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectName` | string | folder name | Display name for the project |
| `defaultTerminalCount` | number | 1 | Number of terminals to open on launch |
| `historyFile` | string | `.patapim/history.txt` | Path to history file |
| `taskFile` | string | `tasks.json` | Path to tasks file |

## Workspace Configuration

### workspace.json

Global workspace configuration tracks open projects and window state.

**Location:** `~/.patapim/workspace.json` (user home directory)

```json
{
  "projects": [
    {
      "path": "/Users/username/project1",
      "lastOpened": "2026-02-06T10:30:00Z"
    }
  ],
  "recentProjects": [
    "/Users/username/project1",
    "/Users/username/project2"
  ],
  "windowState": {
    "width": 1200,
    "height": 800,
    "x": 100,
    "y": 100
  }
}
```

This file is automatically managed by PATAPIM and should not be edited manually.

## Environment Variables

### PATAPIM_DEBUG

Enable development tools for debugging.

```bash
# Windows (PowerShell)
$env:PATAPIM_DEBUG=1
.\node_modules\electron\dist\electron.exe .

# Linux/macOS
PATAPIM_DEBUG=1 electron .
```

When enabled:
- DevTools panel opens automatically
- Console logging is more verbose
- Error messages include stack traces

### PATAPIM_AUTH_SECRET

Authentication secret for remote access (future feature).

```bash
export PATAPIM_AUTH_SECRET="your-secret-key"
```

### PATAPIM_MCP_TOKEN

Authentication token for the MCP browser control REST API.

```bash
# Auto-generated on startup — typically not set manually
echo $PATAPIM_MCP_TOKEN
```

This token is generated automatically when PATAPIM starts and is injected into Claude Code and other AI CLI tools for MCP authentication. You generally don't need to set this manually.

## Runtime Settings (localStorage)

PATAPIM stores user preferences in the browser's localStorage:

| Key | Type | Description |
|-----|------|-------------|
| `patapim.theme` | string | UI theme (`light`, `dark`, `auto`) |
| `patapim.fontSize` | number | Terminal font size (10-20) |
| `patapim.fontFamily` | string | Terminal font family |
| `patapim.gridLayout` | boolean | Enable/disable grid layout |
| `patapim.historyPanel` | boolean | Show/hide history panel |
| `patapim-toolbar-hidden-buttons` | string (JSON) | Toolbar buttons hidden by the user via View > Toolbar Buttons |
| `patapim-dictation-provider` | string | Active dictation provider (whisper, webspeech, local-whisper) |
| `patapim-dictation-mic-device` | string | Selected microphone device ID |
| `patapim-sidebar-width` | number | Sidebar width in pixels |

These are set through the UI and persist across sessions.

## Configuration Files

### Account & Auth Files

| File | Location | Purpose |
|------|----------|---------|
| `account.json` | `~/.patapim/` | Cached account data and plan info |
| `trusted-passkeys.json` | `~/.patapim/` | Registered PassKey credentials |
| `remote-token.json` | `~/.patapim/` | Remote access authentication token |

These files are managed automatically by PATAPIM. Manual editing is not recommended.

## Configuration Priority

PATAPIM follows this priority order:

1. **Environment variables** (highest priority)
2. **Project-level config** (`.patapim/config.json`)
3. **Workspace config** (`~/.patapim/workspace.json`)
4. **Runtime settings** (localStorage)
5. **Default values** (hardcoded)

## Example: Complete Setup

```bash
# 1. Create project config
mkdir .patapim
echo '{
  "projectName": "My App",
  "defaultTerminalCount": 2
}' > .patapim/config.json

# 2. Set environment variable
export PATAPIM_DEBUG=1

# 3. Launch PATAPIM
electron .
```

## Configuration Files Location Summary

| File | Location | Purpose |
|------|----------|---------|
| `config.json` | `<project>/.patapim/` | Project settings |
| `workspace.json` | `~/.patapim/` | Global workspace state |
| `history.txt` | `<project>/.patapim/` | Command history |
| `tasks.json` | `<project>/` | Task tracking |
| `CLAUDE.md` | `<project>/` | Claude Code instructions |
| `STRUCTURE.json` | `<project>/` | Module map |
| `account.json` | `~/.patapim/` | Account and license data |
| `trusted-passkeys.json` | `~/.patapim/` | PassKey credentials |
| `remote-token.json` | `~/.patapim/` | Remote auth token |
| `terminal-logs/` | `~/.patapim/` | Terminal session logs |
