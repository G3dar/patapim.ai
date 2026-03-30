---
title: "CLAUDE.md Reference"
description: "Complete reference for the CLAUDE.md project file"
order: 3
---

## What is CLAUDE.md?

CLAUDE.md is a project instruction file that Claude Code reads automatically at the start of every conversation. It tells Claude how to work with your specific project.

## Generation

Auto-generated when you run `/init` in a Claude Code terminal within a PATAPIM project. You can edit it manually afterward.

## Typical Contents

### Build and Run Commands

```markdown
# Build & Run
- `npm run build` — Bundle renderer with esbuild
- `npm start` — Launch Electron app
- `npm run dist` — Create platform installers
```

### Architecture Overview

High-level description of the project's module structure, entry points, and data flow.

### Project-Specific Rules

```markdown
# Rules
- Always run `npm run build` after changing renderer code
- Terminal sessions are tied to projects, not the app
- Use IPC channels for main/renderer communication
```

### Debugging Tips

```markdown
# Debugging
- Set PATAPIM_DEBUG=1 to open DevTools on startup
- Check ~/.patapim/sessions.json for session state
- MCP token is at ~/.patapim/mcp-token
```

## Best Practices

- **Keep it concise**: Claude reads the entire file at session start. Long files waste tokens.
- **Focus on the "how"**: Build commands, conventions, and gotchas — not project history.
- **Update after major changes**: If you refactor the build system or change conventions, update CLAUDE.md.
- **Commit to Git**: CLAUDE.md is meant to be shared with the team.

## How Claude Code Uses It

When Claude Code starts in a directory containing CLAUDE.md:

1. It reads the file contents as project context
2. It applies any rules or instructions from the file
3. It uses build commands when you ask it to build, test, or deploy
4. It references architecture notes when navigating the codebase

This happens automatically — you don't need to tell Claude to read it.
