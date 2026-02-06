---
title: "Context Preservation"
description: "How PATAPIM prevents context loss between sessions"
order: 3
---

# Context Preservation

The biggest challenge in AI-assisted development is **context loss**. You close the terminal, start a new session, and Claude has no memory of what you built yesterday.

PATAPIM solves this with **automated context preservation**.

## The Problem

Traditional development with Claude Code:

```
Day 1:
You: "Build a settings panel"
Claude: *creates settings.js, updates index.js*
You: "Great, commit it"
[Session ends]

Day 2:
You: "Add a theme toggle to settings"
Claude: "I don't see a settings panel in the codebase..."
```

Claude has no memory of previous sessions. You have to re-explain:

- What you built
- Why you made certain decisions
- What's left to do
- How the modules connect

This context loss wastes time and breaks momentum.

## The Solution: Four Standard Files

PATAPIM projects include four files that preserve context:

1. **CLAUDE.md**: Instructions for Claude
2. **STRUCTURE.json**: Auto-updated module map
3. **PROJECT_NOTES.md**: Session notes and decisions
4. **tasks.json**: Structured task tracking

Together, these files answer:

- **How does this project work?** (CLAUDE.md)
- **What modules exist?** (STRUCTURE.json)
- **What happened previously?** (PROJECT_NOTES.md)
- **What needs to be done?** (tasks.json)

## How Each File Works

### 1. CLAUDE.md: Instructions for Claude

This file contains project-specific instructions. Think of it as the "README for Claude."

**Example CLAUDE.md:**

```markdown
# My SaaS App

This is a Node.js app with React frontend.

## Build Commands

After changing files in `src/`, run:
```bash
npm run build
```

## Project Rules

- Use TypeScript for all new files
- Update STRUCTURE.json after adding modules
- Add tasks to tasks.json when work is deferred
```

**When to update:**

- When you set up the project initially
- When build/run commands change
- When you establish new conventions

CLAUDE.md is **manually maintained** by you or Claude (when you ask).

### 2. STRUCTURE.json: Auto-Updated Module Map

This file maps your codebase: which modules exist, what they export, and how they depend on each other.

**Example STRUCTURE.json:**

```json
{
  "modules": {
    "main/menu": {
      "path": "src/main/menu.js",
      "purpose": "Application menu bar",
      "exports": ["createMenu", "updateMenu"],
      "depends": ["electron", "main/window"]
    },
    "renderer/settings": {
      "path": "src/renderer/settings.js",
      "purpose": "Settings panel UI",
      "exports": ["showSettings", "saveSettings"],
      "depends": ["shared/config"]
    }
  },
  "ipcChannels": {
    "SAVE_SETTINGS": {
      "direction": "renderer → main",
      "handler": "main/config.js"
    }
  }
}
```

**How it's updated:**

STRUCTURE.json is updated automatically via a **pre-commit hook**:

```bash
git commit -m "Add settings panel"
[Pre-commit hook runs]
Updating STRUCTURE.json...
Done.
```

The hook scans your codebase, detects modules, and updates STRUCTURE.json before the commit is finalized.

**Why this matters:**

Claude reads STRUCTURE.json at the start of each session. Instead of searching the entire codebase, Claude knows:

- "Settings logic is in `renderer/settings.js`"
- "To save settings, use the `SAVE_SETTINGS` IPC channel"
- "The handler is in `main/config.js`"

This dramatically speeds up Claude's context-gathering.

### 3. PROJECT_NOTES.md: Session Notes and Decisions

This file captures what happened in previous sessions.

**Example PROJECT_NOTES.md:**

```markdown
# Project Notes

## Session Notes

### [2026-02-05] Added settings panel
User requested a settings panel for theme customization.

Created `src/renderer/settings.js` with theme toggle.
Wired up IPC channel `SAVE_SETTINGS` to persist preferences.

Decision: Store settings in `~/.config/my-app/settings.json`
instead of localStorage (works in Electron main process).

### [2026-02-04] Fixed terminal resize bug
Terminal wasn't resizing when sidebar was toggled.

Solution: Listen to `resize` event and call `terminal.fit()`.
Added debounce to avoid excessive redraws.
```

**How it's updated:**

Claude asks to add notes when:

- A task is successfully completed
- An architectural decision is made
- A complex bug is solved
- Work is deferred ("let's do this later")

**Example conversation:**

```
You: "Great, the settings panel works!"
Claude: "Should I add this to PROJECT_NOTES.md?"
You: "Yes"
Claude: *appends session note*
```

**Why this matters:**

In the next session, Claude reads PROJECT_NOTES.md and understands:

- What features were added
- Why certain decisions were made
- What problems were encountered and how they were solved

This prevents re-work and re-explaining.

### 4. tasks.json: Structured Task Tracking

This file tracks pending, in-progress, and completed tasks.

**Example tasks.json:**

```json
{
  "tasks": [
    {
      "id": "add-theme-toggle",
      "title": "Add theme toggle to settings",
      "status": "in_progress",
      "priority": "high",
      "category": "feature",
      "userRequest": "User said: Add a dark mode toggle",
      "description": "Create theme toggle in settings panel. Add IPC handler to save theme preference. Apply theme on app start.",
      "acceptanceCriteria": "User can toggle dark mode and preference persists across restarts",
      "createdAt": "2026-02-06T10:00:00Z",
      "updatedAt": "2026-02-06T10:30:00Z"
    },
    {
      "id": "fix-resize-bug",
      "title": "Fix terminal resize bug",
      "status": "completed",
      "userRequest": "Terminal doesn't resize when sidebar is toggled",
      "description": "Add resize event listener and call terminal.fit()",
      "completedAt": "2026-02-04T14:00:00Z"
    }
  ]
}
```

**How it's updated:**

Claude detects tasks during conversation and asks:

```
You: "Let's add a theme toggle, but let's do the settings panel first"
Claude: "I identified these tasks from our conversation:
  1. Add settings panel
  2. Add theme toggle
Should I add them to tasks.json?"
You: "Yes"
Claude: *adds tasks*
```

When a task is completed:

```
You: "The theme toggle works!"
Claude: *marks task as completed, updates completedAt*
```

**Why this matters:**

In the next session, Claude reads tasks.json and knows:

- What's pending
- What's in progress
- What's been completed

You don't have to remember and re-explain your task list.

## The Workflow of Context Preservation

Here's how context preservation works in practice:

### Session 1: Initial Work

```
You: "Build a settings panel"
Claude: *reads CLAUDE.md, STRUCTURE.json*
Claude: *creates src/renderer/settings.js*
Claude: *updates src/renderer/index.js*
You: "npm run build && npm start"
You: "Looks good, commit it"
Claude: *creates commit*
[Pre-commit hook updates STRUCTURE.json]
Claude: "Should I add this to PROJECT_NOTES.md?"
You: "Yes"
Claude: *appends session note*
```

Context saved:

- STRUCTURE.json knows about `renderer/settings.js`
- PROJECT_NOTES.md documents the session
- Commit history shows the work

### Session 2: Continuing Work

```
[You open PATAPIM the next day]
You: "Add a theme toggle to the settings panel"
Claude: *reads PROJECT_NOTES.md, sees settings panel was added*
Claude: *reads STRUCTURE.json, knows settings.js exists*
Claude: *modifies src/renderer/settings.js*
Claude: *adds IPC handler for saving theme preference*
You: "Works! Commit it"
Claude: *creates commit*
[Pre-commit hook updates STRUCTURE.json]
Claude: "Should I add this to PROJECT_NOTES.md?"
You: "Yes"
```

No context loss. Claude picked up exactly where you left off.

### Session 3: Bug Fix

```
You: "Terminal doesn't resize when sidebar is toggled"
Claude: *reads STRUCTURE.json, finds terminal initialization code*
Claude: *identifies missing resize listener*
Claude: "I'll add a resize event listener and call terminal.fit()"
Claude: *fixes bug*
You: "Test it... works!"
Claude: "Should I add this to PROJECT_NOTES.md?"
You: "Yes"
Claude: *appends bug fix note*
```

Months later, if the bug reappears, Claude can read PROJECT_NOTES.md and understand what was done.

## Automation is Key

PATAPIM automates context preservation:

- **Pre-commit hooks** update STRUCTURE.json automatically
- **Claude prompts** for PROJECT_NOTES.md at appropriate moments
- **Task detection** identifies work to add to tasks.json

You don't have to remember to update these files—the system handles it.

## Benefits

With context preservation:

- **No re-explaining**: Claude knows what happened last session
- **Faster context gathering**: STRUCTURE.json eliminates codebase searching
- **Session continuity**: Pick up where you left off, every time
- **Team collaboration**: Share context via Git (team members get the same context)
- **Long-term memory**: Decisions and solutions are documented, not forgotten

## Best Practices

### Let Claude Update the Files

When Claude asks "Should I add this to PROJECT_NOTES.md?", say yes. These moments are when context is captured.

### Don't Skip Pre-Commit Hooks

The pre-commit hook updates STRUCTURE.json. If you bypass it (e.g., `git commit --no-verify`), STRUCTURE.json falls out of sync.

### Review Context Files Periodically

Every few weeks, review:

- **PROJECT_NOTES.md**: Archive old notes if it gets too long
- **tasks.json**: Remove very old completed tasks
- **STRUCTURE.json**: Ensure it's accurate (usually auto-updated correctly)

### Commit Context Files

Always commit CLAUDE.md, STRUCTURE.json, PROJECT_NOTES.md, and tasks.json. These files are documentation, not temporary artifacts.

## Summary

Context preservation is PATAPIM's core strength. By maintaining four standard files:

- **CLAUDE.md**: Instructions for Claude
- **STRUCTURE.json**: Auto-updated module map
- **PROJECT_NOTES.md**: Session notes
- **tasks.json**: Task tracking

...Claude always has the context needed to continue your work. No re-explaining, no context loss, no wasted time.
