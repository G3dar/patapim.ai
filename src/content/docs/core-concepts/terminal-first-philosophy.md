---
title: "Terminal-First Philosophy"
description: "Why PATAPIM puts the terminal at the center"
order: 1
---

# Terminal-First Philosophy

PATAPIM is built on a simple principle: **Claude Code is a terminal tool, so your IDE should be terminal-first.**

## Why Terminal-First?

Claude Code operates through a command-line interface. It reads files, writes code, runs commands, and commits changes—all from the terminal. This isn't a limitation; it's the natural workflow for AI-assisted development.

When you use Claude Code, you're working in a **conversation-driven development cycle**:

1. You describe what you need
2. Claude reads your codebase
3. Claude makes changes
4. You test the results
5. Claude commits the work

The terminal is where this happens. PATAPIM embraces this reality instead of fighting it.

## Why Not VS Code or Cursor?

VS Code and Cursor are excellent **code editors** designed for manual coding. They excel at:

- Syntax highlighting and IntelliSense
- Manual refactoring and navigation
- Interactive debugging with breakpoints
- Extensions for specific languages

But they were built for *you* to write code, not for Claude to write code.

### The Mismatch

When using Claude Code with traditional editors, you encounter friction:

- **Context switching**: Terminal → Editor → Terminal → Browser
- **Manual file management**: Opening files Claude just created
- **Lost context**: Claude can't see what's in your editor
- **Tool duplication**: Terminal commands + editor commands for the same task

PATAPIM eliminates this friction by putting the terminal at the center.

## What Makes PATAPIM Different?

PATAPIM is **not a code editor**. It's a **framework for Claude Code development**.

### PATAPIM is a Framework

Think of PATAPIM as the scaffolding around your development workflow:

- **Terminal-first UI**: The terminal is the primary interface, not a sidebar
- **Integrated browser**: Test your web apps without leaving the workspace
- **Project structure**: Standardized files for context preservation
- **Session continuity**: Claude picks up where you left off

### What PATAPIM Provides

- **Workspace management**: Switch between projects instantly
- **Context files**: CLAUDE.md, STRUCTURE.json, PROJECT_NOTES.md, tasks.json
- **Auto-documentation**: Pre-commit hooks keep STRUCTURE.json updated
- **Built-in DevTools**: Debug web apps in the integrated browser

### What PATAPIM Doesn't Replace

PATAPIM doesn't replace your code editor. When you need to:

- Manually write complex code
- Debug with breakpoints
- Use language-specific tools

...you can still open your project in VS Code, Cursor, or any editor. PATAPIM manages the **Claude Code workflow**, not manual coding.

## The Claude Code Workflow

Here's how PATAPIM fits into your development process:

### 1. Start a Session

Open PATAPIM, select your project. Claude reads your context files (CLAUDE.md, PROJECT_NOTES.md, tasks.json) and understands:

- What the project is
- What happened last session
- What needs to be done next

### 2. Work with Claude

You work in the terminal:

```
You: "Add a settings panel to the UI"
Claude: *reads STRUCTURE.json, identifies relevant files*
Claude: *modifies src/renderer/settings.js*
Claude: *updates src/renderer/index.js*
You: "npm run build"
```

### 3. Test in Browser

The integrated browser shows your changes immediately. No alt-tabbing, no external browser windows.

### 4. Commit and Document

When the work is done:

```
You: "Commit this"
Claude: *creates commit*
Pre-commit hook: *updates STRUCTURE.json automatically*
Claude: "Should I add this to PROJECT_NOTES.md?"
```

Your context is preserved for the next session.

## Terminal-First ≠ Terminal-Only

PATAPIM is terminal-first, not terminal-only. The integrated browser panel is critical for web development. The file tree provides navigation. The project list enables workspace management.

But the **terminal remains central** because that's where Claude Code lives. Everything else supports the terminal workflow.

## The Result

With PATAPIM, you work **with** Claude Code's nature, not against it:

- No context switching between windows
- No manual file hunting
- No lost conversation history
- No "what did we do last session?" moments

You focus on building. Claude focuses on coding. PATAPIM manages the rest.
