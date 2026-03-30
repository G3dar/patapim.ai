---
title: "Quick Start"
description: "Get up and running with PATAPIM in 5 minutes"
order: 2
---

## First Launch

When you open PATAPIM, you'll see a 3-panel layout:

- **Left**: Sidebar with file explorer and project list
- **Center**: Terminal area (tab view by default)
- **Right**: Toggleable panels (history, tasks, GitHub, remote, find, preferences, sessions)

## Create Your First Project

1. Click the **Projects** button in the sidebar
2. Click **Add Project**
3. Select an existing project folder
4. PATAPIM opens the project and starts a terminal in that directory

## Run Your First Terminal

PATAPIM gives you a real pseudo-terminal (PTY) — the same technology used by VS Code's terminal. You can run any command you'd run in a native terminal.

- Press **Ctrl+Shift+T** to open a new terminal
- Use **Ctrl+1** through **Ctrl+9** to switch between terminals
- Press **Ctrl+Shift+G** to toggle grid view (see up to 9 terminals at once)

## Start Claude Code

Press **Ctrl+K** to open the Claude quick-ask dialog, or type `claude` in any terminal. PATAPIM wraps Claude Code natively — your conversations, context files, and sessions are all preserved.

PATAPIM also supports Codex and Gemini CLI. Each terminal can run a different AI agent.

## Try Voice Dictation

PATAPIM includes built-in voice dictation powered by Parakeet V3 (runs locally, no API key needed):

1. Click the **microphone button** in the lower-right corner
2. Follow the setup wizard (first time only)
3. Hold **Ctrl+Alt** and speak, then release to transcribe

Your voice is processed entirely on your device. Nothing leaves your machine.

## Essential Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Start Claude Code |
| `Ctrl+Shift+T` | New terminal |
| `Ctrl+1-9` | Switch to terminal N |
| `Ctrl+Shift+G` | Toggle grid view |
| `Ctrl+Alt` (hold) | Push-to-talk dictation |
| `Ctrl+F` | Open find panel |
| `Ctrl+,` | Open preferences |

## Basic Workflow

1. **Open a project** — Add it via the sidebar
2. **Start an AI agent** — `Ctrl+K` or type `claude` / `codex` / `gemini`
3. **Use multiple terminals** — Run builds, tests, and agents side by side
4. **Dictate instead of typing** — Hold `Ctrl+Alt` to speak
5. **Check from your phone** — Enable remote access in preferences for on-the-go monitoring

## Context Files

PATAPIM automatically creates context files in your project that help AI agents understand your codebase:

- **CLAUDE.md** — Instructions for Claude Code
- **STRUCTURE.json** — Module map and IPC channels
- **tasks.json** — Task tracking

Run `/init` in a Claude Code terminal to generate these files.
