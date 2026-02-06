---
title: "CLAUDE.md Reference"
description: "Complete reference for the CLAUDE.md project file"
order: 3
---

# CLAUDE.md Reference

The `CLAUDE.md` file is the main instruction file for Claude Code when working with your project. It tells Claude how to navigate your codebase, manage tasks, and preserve context.

## What is CLAUDE.md?

`CLAUDE.md` is a markdown file at your project root that contains:

- **Project navigation instructions** - Where to find important files
- **Task management rules** - How to track and organize work
- **Context preservation rules** - When and how to document decisions
- **Build and debug instructions** - How to test changes
- **Documentation update rules** - When to update STRUCTURE.json, PROJECT_NOTES.md, etc.

Claude Code automatically reads this file at the start of each session.

## File Location

```
<project-root>/CLAUDE.md
```

## Core Structure

### 1. Build Instructions

Tell Claude how to build and test your project.

```markdown
## ⚠️ IMPORTANT: Build After Changes

**After modifying any file in `src/renderer/`**, you MUST run:

\`\`\`bash
cd /c/Users/ghell/patapim && npm run build
\`\`\`

This compiles the renderer code to `dist/renderer.js`.
```

**Why this matters:** Claude needs to know the build workflow to ensure changes take effect.

### 2. Project Navigation

Point Claude to the key project files.

```markdown
## 🧭 Project Navigation

**Read these files at the start of each session:**

1. **STRUCTURE.json** - Module map, which file is where
2. **PROJECT_NOTES.md** - Project vision, past decisions, session notes
3. **tasks.json** - Pending tasks

**Workflow:**
1. Read these files to understand the project and capture context
2. Identify relevant files based on the task
3. Update STRUCTURE.json after making changes
```

**Purpose:** Helps Claude understand your codebase architecture quickly.

### 3. Task Management Rules

Define how tasks are tracked in `tasks.json`.

```markdown
## Task Management (tasks.json)

### Task Recognition Rules

**These ARE TASKS - add to tasks.json:**
- When the user requests a feature or change
- Decisions like "Let's do this", "Let's add this"
- Deferred work when we say "We'll do this later"

**These are NOT TASKS:**
- Error messages and debugging sessions
- Questions, explanations
- Work already completed
```

**Task Structure:**

```json
{
  "id": "unique-id",
  "title": "Short and clear title (max 60 characters)",
  "description": "Detailed explanation - what, how, which files",
  "userRequest": "User's original request/prompt",
  "acceptanceCriteria": "When is this task complete?",
  "status": "pending | in_progress | completed",
  "priority": "high | medium | low",
  "category": "feature | fix | refactor | docs | test"
}
```

**Task Content Rules:**

- **title:** Action-oriented (e.g., "Add tasks button to toolbar")
- **description:** Technical details - what, how, which files (2-3 sentences minimum)
- **userRequest:** Exact copy of user's words
- **acceptanceCriteria:** Concrete, testable completion criteria

### 4. Context Preservation Rules

Define when to update `PROJECT_NOTES.md`.

```markdown
## 📝 Context Preservation (Automatic Note Taking)

### When to Ask?

Ask the user: **"Should I add this conversation to PROJECT_NOTES.md?"**

- When a task is successfully completed
- When an important architectural decision is made
- When a bug is fixed and the solution is noteworthy
- When "let's do this later" is said

### Completion Detection

Pay attention to these signals:
- User approval: "okay", "done", "it worked", "nice"
- Moving from one topic to another
```

**Format:**

```markdown
### [2026-02-06] Topic title
Conversation/decision as is, with its context...
```

### 5. STRUCTURE.json Rules

Tell Claude when and how to update the module map.

```markdown
## STRUCTURE.json Rules

### When to Update?
- When a new file/folder is created
- When a file/folder is deleted or moved
- When module dependencies change
- When an IPC channel is added or changed

### Update Rules
- Pre-commit hook updates automatically
- Manual: `npm run structure`
```

## How Claude Code Reads CLAUDE.md

1. **Session start:** Claude reads CLAUDE.md automatically
2. **Follows instructions:** Uses the rules defined in CLAUDE.md throughout the session
3. **References during work:** Checks CLAUDE.md when making decisions about tasks, documentation, etc.

## When to Update CLAUDE.md

Update `CLAUDE.md` when:

- **Build process changes** (new build commands, different output paths)
- **New documentation files added** (new files to track in Project Navigation)
- **Task management workflow changes** (new task categories, different rules)
- **Project structure evolves** (new important files or patterns)

## Best Practices

### ✅ Do

- **Be specific:** Include exact commands with full paths
- **Explain why:** Add context for each rule (e.g., "This compiles renderer code to dist/")
- **Use examples:** Show concrete examples of task structures, note formats, etc.
- **Keep it current:** Update as your project evolves

### ❌ Don't

- **Don't be vague:** Avoid "build the project" without showing how
- **Don't duplicate:** Don't repeat information that's in other files
- **Don't over-prescribe:** Focus on important rules, not every detail
- **Don't forget to update:** Stale instructions cause confusion

## Example: Minimal CLAUDE.md

```markdown
# MyProject - Claude Code Instructions

## Build After Changes

After modifying `src/` files:

\`\`\`bash
npm run build
\`\`\`

## Project Navigation

Read these files at session start:
1. **STRUCTURE.json** - Module map
2. **tasks.json** - Pending tasks

## Task Management

Add to tasks.json when user requests features or says "let's do X later".

Task structure:
- title: Short action (max 60 chars)
- description: What, how, which files
- status: pending | in_progress | completed
```

## Integration with PATAPIM

PATAPIM enhances `CLAUDE.md` with:

- **Visual task panel** - View tasks.json in the UI
- **History tracking** - Automatic command history in `.patapim/history.txt`
- **Quick access** - Keyboard shortcuts for /init, /commit based on CLAUDE.md instructions

## Related Files

- **STRUCTURE.json** - Module map referenced by CLAUDE.md
- **PROJECT_NOTES.md** - Session notes referenced by CLAUDE.md
- **tasks.json** - Task tracking referenced by CLAUDE.md
- **QUICKSTART.md** - Installation guide (can be referenced in CLAUDE.md)

## Template

You can generate a CLAUDE.md template with:

```bash
npx create-patapim-project
```

Or copy from the [PATAPIM repository](https://github.com/yourusername/patapim/blob/main/CLAUDE.md).
