---
title: "Multi-Terminal"
description: "Run up to 9 terminals simultaneously"
order: 1
---

## Overview

PATAPIM supports up to 9 concurrent terminals using **xterm.js 5.3** and **node-pty 1.0** for real pseudo-terminal allocation.

## View Modes

### Tab View (Default)

Terminals appear as tabs. Double-click a tab to rename it.

### Grid View

Press `Ctrl+Shift+G` to toggle. Layouts: 2x1, 2x2, 3x1, 3x2, 3x3. Grid cells are resizable with drag handles.

## Project-Aware

Terminals start in the active project directory. Switching projects switches all terminals.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+T` | New terminal |
| `Ctrl+Shift+W` | Close terminal |
| `Ctrl+1-9` | Switch to terminal N |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Next / previous terminal |
| `Ctrl+Shift+G` | Toggle grid view |

## Plan Limits

- **Free**: Up to 9 terminals
- **Pro / Lifetime**: Unlimited
