---
title: "Keyboard Shortcuts"
description: "Complete list of PATAPIM keyboard shortcuts"
order: 1
---

# Keyboard Shortcuts

Complete reference for all keyboard shortcuts in PATAPIM.

## Claude Code Integration

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+K` | Start Claude Code | Opens Claude Code in the active terminal |
| `Ctrl+I` | Run /init | Runs the `/init` skill to set up project context |
| `Ctrl+Shift+C` | Run /commit | Runs the `/commit` skill to create a git commit |

## Terminal Management

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Shift+T` | New terminal | Creates a new terminal session |
| `Ctrl+Shift+W` | Close terminal | Closes the active terminal |
| `Ctrl+Tab` | Next terminal | Switches to the next terminal tab |
| `Ctrl+Shift+Tab` | Previous terminal | Switches to the previous terminal tab |
| `Ctrl+1-9` | Switch to terminal N | Jumps directly to terminal 1-9 |

## History & Search

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+H` | Open history file | Opens the `.patapim/history.txt` file in editor |
| `Ctrl+Shift+H` | Toggle history panel | Shows/hides the history sidebar panel |
| `Ctrl+F` | Find in terminal | Opens find dialog for terminal content |

## Layout & View

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Shift+G` | Toggle grid view | Switches between single and grid terminal layout |
| `Escape` | Close editor/panel | Closes the active editor or sidebar panel |

## Editor

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+S` | Save file | Saves the current file in the editor |
| `Escape` | Close editor | Closes the active editor view |

## Platform Notes

- All shortcuts listed use `Ctrl` on Windows/Linux
- On macOS, use `Cmd` instead of `Ctrl` for most shortcuts
- Some shortcuts may conflict with terminal applications (use with care)

## Custom Shortcuts

You can customize keyboard shortcuts by modifying the `src/main/menu.js` file in the PATAPIM codebase. Look for the `accelerator` properties in the menu configuration.

```javascript
{
  label: 'Start Claude Code',
  accelerator: 'CommandOrControl+K',
  click: () => { /* handler */ }
}
```
