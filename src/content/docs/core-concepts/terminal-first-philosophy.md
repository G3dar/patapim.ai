---
title: "Terminal-First Philosophy"
description: "Why PATAPIM puts the terminal at the center"
order: 1
---

## The Terminal IS the IDE

PATAPIM is built on a simple premise: when you're working with AI coding agents like Claude Code, Codex, or Gemini CLI, the terminal is where everything happens. Code editors become secondary.

Traditional IDEs treat the terminal as an afterthought — a small panel at the bottom you resize when you need it. PATAPIM flips this: the terminal occupies center stage, and everything else revolves around it.

## Real PTY, Not a Simulation

PATAPIM uses **xterm.js 5.3** and **node-pty 1.0** to provide real pseudo-terminal allocation. This means:

- Full shell emulation with signals, job control, colors, and resize
- Proper stdin/stdout/stderr handling
- Native terminal dimensions that AI agents can detect
- Every program that works in your system terminal works in PATAPIM

This is the same terminal technology used by VS Code, but in PATAPIM it's the primary interface — not a secondary panel.

## 3-Panel Layout

PATAPIM organizes your workspace into three areas:

| Panel | Position | Content |
|-------|----------|---------|
| **Sidebar** | Left | File explorer, project list |
| **Terminals** | Center | Tab view or grid view (up to 9) |
| **Panels** | Right (toggleable) | History, tasks, GitHub, remote, find, preferences, sessions |

The center panel — where your terminals live — always takes the most space. Side panels toggle in and out as needed.

## Why This Matters for AI

AI coding agents need a real terminal, not a text box. With node-pty, Claude Code gets:

- Proper terminal dimensions (it adjusts output formatting to your window size)
- Signal handling (Ctrl+C actually sends SIGINT)
- Full ANSI color support (diff output, syntax highlighting in responses)
- Process isolation (each terminal is an independent shell session)

When you run `claude` in PATAPIM, it behaves identically to running it in your native terminal — because it IS a real terminal.

## Multi-Agent Workflow

The terminal-first design enables running multiple AI agents simultaneously. In a 3x3 grid, you could have:

- Claude Code refactoring a module in terminal 1
- Codex writing tests in terminal 2
- A dev server running in terminal 3
- Your build process in terminal 4

Each terminal is independent. You see all of them at once and can interact with any of them.
