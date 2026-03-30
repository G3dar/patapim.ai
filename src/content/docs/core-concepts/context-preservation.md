---
title: "Context Preservation"
description: "How PATAPIM prevents context loss between sessions"
order: 3
---

## The Problem

When working with AI agents across multiple sessions, context gets lost. The agent forgets what was decided, what architecture choices were made, and what tasks remain. You end up re-explaining the same things every session.

## The Solution: 5 Context Files

Every PATAPIM project maintains standardized files that preserve development context. AI agents like Claude Code read these automatically.

### CLAUDE.md

**Purpose**: Instructions for Claude Code. Tells the AI how to work with your project.

**Generated**: Auto-created when you run `/init` in a Claude Code terminal.

**Contains**:
- Build and run commands
- Architecture overview
- Project-specific rules and conventions
- Debugging tips
- Multi-instance support configuration

Claude Code reads this file automatically at the start of every conversation.

### STRUCTURE.json

**Purpose**: Complete module map of your project with IPC channels and architecture notes.

**Generated**: Auto-generated and updated via pre-commit hook or manually.

**Format**:
```json
{
  "modules": {
    "main": ["index.js", "ptyManager.js", "remoteServer.js"],
    "renderer": ["index.js", "terminalManager.js", "fileTreeUI.js"]
  },
  "ipc": {
    "terminal": ["terminal-create", "terminal-destroy", "terminal-input-id"],
    "browser": ["browser:create", "browser:navigate", "browser:screenshot"]
  },
  "architecture": "Electron app with main/renderer split..."
}
```

Helps AI agents understand project structure without reading every file.

### PROJECT_NOTES.md

**Purpose**: Decision log that captures important choices and lessons learned.

**Format**: Entries use `### [YYYY-MM-DD] Topic` heading format.

**Updated**: Claude Code can add notes after important decisions. You can also say "add this to notes" during a conversation.

```markdown
### [2026-01-15] Switched to Parakeet V3 for voice
Replaced Whisper API with local Parakeet V3 via sherpa-onnx.
Reason: zero latency, no API key needed, fully offline.

### [2026-01-20] Remote auth refactor
Added PassKey/WebAuthn support for remote sessions.
PIN-based auth kept as fallback (5-minute TTL).
```

### tasks.json

**Purpose**: Structured task tracking synced with PATAPIM's task panel.

**Format**:
```json
{
  "tasks": [
    {
      "id": "a1b2c3",
      "text": "Fix authentication flow",
      "status": "in_progress",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T14:30:00Z"
    }
  ]
}
```

**Status values**: `pending` → `in_progress` → `ready_to_test` → `completed`

The task panel in PATAPIM reads and writes this file. Click the play button on a task to send it to the active terminal.

### QUICKSTART.md

**Purpose**: Development quick-start guide for new team members or fresh sessions.

**Contains**: Setup commands, key files table, project structure overview.

Auto-generated on project init. Gives any developer (or AI agent) a fast onramp to the project.

## How It Works Together

When you start a new Claude Code session in a PATAPIM project:

1. Claude reads **CLAUDE.md** for project instructions
2. Claude reads **STRUCTURE.json** to understand the codebase layout
3. Claude checks **tasks.json** to see what's in progress
4. Claude can reference **PROJECT_NOTES.md** for past decisions

No re-explaining. No lost context. Every session starts where the last one left off.

## Portability

All context files are plain text and committed to your Git repository. When a team member clones the project and opens it in PATAPIM, they get the full context immediately.
