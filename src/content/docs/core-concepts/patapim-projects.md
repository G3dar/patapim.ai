---
title: "PATAPIM Projects"
description: "Understanding the PATAPIM project structure"
order: 2
---

# PATAPIM Projects

A **PATAPIM project** is a directory with standardized files and configuration that enable Claude Code to maintain context across sessions.

## What is a PATAPIM Project?

At its core, a PATAPIM project is any directory that contains:

1. **Standard context files**: CLAUDE.md, STRUCTURE.json, PROJECT_NOTES.md, tasks.json
2. **A .patapim directory**: Stores project-specific configuration
3. **Git repository** (recommended): For version control and auto-documentation

When you open a project in PATAPIM, Claude automatically reads these files and understands:

- How to work with your codebase (CLAUDE.md)
- What modules exist and how they connect (STRUCTURE.json)
- What happened in previous sessions (PROJECT_NOTES.md)
- What tasks are pending (tasks.json)

## Initializing a Project

### Option 1: Initialize an Existing Directory

If you have an existing codebase, initialize it as a PATAPIM project:

```bash
cd /path/to/your/project
patapim init
```

This creates:

```
your-project/
├── .patapim/
│   └── config.json
├── CLAUDE.md
├── STRUCTURE.json
├── PROJECT_NOTES.md
├── tasks.json
└── (your existing files)
```

### Option 2: Create a New Project

Start from scratch:

```bash
patapim new my-project
cd my-project
```

PATAPIM scaffolds a new project with:

- Context files (CLAUDE.md, STRUCTURE.json, etc.)
- .patapim directory
- Git repository initialized
- Pre-commit hooks configured

### What Gets Created?

#### CLAUDE.md

Instructions for Claude Code. This file tells Claude:

- How to build and run your project
- Project-specific conventions
- When to update documentation
- Task management rules

Think of this as the "README for Claude."

#### STRUCTURE.json

An auto-generated map of your codebase:

```json
{
  "modules": {
    "main/menu": {
      "path": "src/main/menu.js",
      "purpose": "Application menu bar",
      "exports": ["createMenu", "updateMenu"],
      "depends": ["electron", "main/window"]
    }
  },
  "ipcChannels": {
    "OPEN_PROJECT": {
      "direction": "renderer → main",
      "handler": "main/projectManager.js"
    }
  }
}
```

This file is updated automatically via pre-commit hooks (if configured).

#### PROJECT_NOTES.md

Session notes and decisions. Claude asks to add notes when:

- A task is completed
- An architectural decision is made
- A complex bug is solved
- Work is deferred ("let's do this later")

Format:

```markdown
### [2026-02-06] Added settings panel
User requested a settings panel for theme customization.
Created src/renderer/settings.js with theme toggle...
```

#### tasks.json

Structured task tracking:

```json
{
  "tasks": [
    {
      "id": "add-settings-panel",
      "title": "Add settings panel to UI",
      "status": "completed",
      "userRequest": "Add a settings panel",
      "description": "Create settings.js module...",
      "acceptanceCriteria": "Settings panel opens and saves preferences",
      "completedAt": "2026-02-06T14:30:00Z"
    }
  ]
}
```

## The .patapim Directory

The `.patapim` directory stores project-specific configuration:

```
.patapim/
├── config.json          # Project settings
├── terminal-history.log # Terminal session history (optional)
└── bookmarks.json       # File/folder bookmarks (future)
```

### config.json

Stores project metadata:

```json
{
  "name": "My Project",
  "initialized": "2026-02-06T10:00:00Z",
  "lastOpened": "2026-02-06T14:30:00Z",
  "settings": {
    "terminalShell": "bash",
    "defaultBranch": "main"
  }
}
```

This file is managed by PATAPIM—you rarely need to edit it manually.

## Project List & Workspace

PATAPIM maintains a **workspace**: a list of all projects you've opened.

### Viewing Projects

Open the project list:

- Click the projects icon in the toolbar
- Or press `Ctrl+P` (keyboard shortcut, if configured)

You'll see:

```
┌─────────────────────────────┐
│ Projects                    │
├─────────────────────────────┤
│ patapim                     │
│ /Users/ghell/patapim        │
│ Last opened: 2 hours ago    │
├─────────────────────────────┤
│ my-website                  │
│ /Users/ghell/my-website     │
│ Last opened: 3 days ago     │
└─────────────────────────────┘
```

### Adding Projects

Projects are added automatically when you:

1. Use `patapim init` in a directory
2. Use `patapim new project-name`
3. Open a directory via "Open Folder" in PATAPIM

### Removing Projects

Remove a project from the list (doesn't delete files):

```bash
patapim remove-project /path/to/project
```

Or remove from the UI (right-click → Remove from list).

## Switching Between Projects

Click a project in the project list to switch. PATAPIM:

1. Saves the current terminal session
2. Closes the current project
3. Opens the new project directory
4. Loads context files (CLAUDE.md, etc.)
5. Restores the terminal in the new project directory

Your terminal history and context are preserved for each project.

## Project Portability

PATAPIM projects are portable. The context files (CLAUDE.md, STRUCTURE.json, etc.) are plain text and committed to your Git repository.

This means:

- **Team members** can clone your repo and open it in PATAPIM—Claude gets the same context
- **Different machines**: Your laptop and desktop share the same project context via Git
- **No lock-in**: The files are human-readable. You can use them without PATAPIM if needed.

## Best Practices

### Keep Context Files Updated

Let Claude update STRUCTURE.json (via pre-commit hooks) and PROJECT_NOTES.md (when prompted). Don't skip these steps—they're critical for session continuity.

### One Project Per Repository

Each Git repository should be one PATAPIM project. Don't nest PATAPIM projects inside each other.

### Commit Context Files

Always commit CLAUDE.md, STRUCTURE.json, PROJECT_NOTES.md, and tasks.json. These files are documentation, not temporary artifacts.

### Use Descriptive Project Names

When creating projects, use clear names:

```bash
patapim new my-saas-app      # ✅ Clear
patapim new project1         # ❌ Vague
```

The project name appears in the project list and terminal title.

## Summary

A PATAPIM project is:

- A directory with standardized context files
- A .patapim directory for configuration
- Part of a workspace managed by PATAPIM

By standardizing project structure, PATAPIM ensures Claude Code always has the context needed to continue your work.
