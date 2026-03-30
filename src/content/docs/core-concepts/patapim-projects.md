---
title: "PATAPIM Projects"
description: "Understanding the PATAPIM project structure"
order: 2
---

## Workspace Management

PATAPIM manages projects through a workspace system. Your workspace configuration is stored at `~/.patapim/workspaces.json` and tracks all your projects.

### Adding a Project

1. Click the **Projects** button in the sidebar
2. Click **Add Project**
3. Select an existing project folder
4. PATAPIM adds it to your workspace and opens it

You can add as many projects as you want. The Free plan allows up to 3 active projects; Pro and Lifetime are unlimited.

### Switching Projects

Click any project in the sidebar to switch to it. When you switch projects:

- All terminal sessions switch to the new project directory
- The file tree updates to show the new project's files
- Session state (terminal content, working directories) is preserved per project
- Tasks, GitHub issues, and context files update to the new project

This **project isolation** means each project has its own independent workspace.

## Project Files

Each PATAPIM project can contain these files in its root directory:

| File | Purpose | Generated |
|------|---------|-----------|
| `CLAUDE.md` | Instructions for Claude Code | On `/init` |
| `STRUCTURE.json` | Module map and IPC channels | Auto/manual |
| `PROJECT_NOTES.md` | Decision log | During sessions |
| `tasks.json` | Task tracking | Via task panel |
| `QUICKSTART.md` | Quick-start guide | On init |

These files are plain text and can be committed to your Git repository.

## Per-Project Configuration

Each project can have a `.patapim/` directory in its root for project-specific configuration:

```
my-project/
├── .patapim/
│   └── config.json    # Project-specific settings
├── CLAUDE.md
├── STRUCTURE.json
├── tasks.json
└── ... (your code)
```

## Global Configuration

Global PATAPIM data is stored at `~/.patapim/`:

| File | Purpose |
|------|---------|
| `workspaces.json` | Project list and metadata |
| `sessions.json` | Terminal sessions per project |
| `account.json` | Auth token, email, license |
| `passkeys.json` | WebAuthn credentials |
| `trusted-passkeys.json` | Trusted PassKey whitelist |
| `downloads/` | Browser download directory |
| `mcp-token` | MCP server authentication |

## Session Persistence

Terminal sessions are saved per project. When you close PATAPIM and reopen it:

1. Your last active project is restored
2. All terminal sessions for that project are re-created
3. Working directories are restored
4. Claude Code session IDs are preserved (sessions can be resumed)

Sessions are stored in `~/.patapim/sessions.json`. The restore process has a 10-second timeout — if a session can't be restored in time, a fresh terminal is created instead.

## File Explorer

The sidebar includes a file explorer that shows your project's file tree:

- Displays up to 5 levels deep
- Excludes `node_modules`, `.git`, and other common ignored directories
- Click a file to open it in the overlay editor
- Files are sorted with directories first
