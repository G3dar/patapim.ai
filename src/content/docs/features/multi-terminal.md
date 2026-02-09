---
title: "Multi-Terminal"
description: "Run up to 9 terminals simultaneously"
order: 1
---

# Multi-Terminal

PATAPIM supports running up to 9 terminal sessions simultaneously, with flexible viewing options to match your workflow.

## View Modes

### Tab View

The default view shows a single terminal with tab switching. All terminals run in the background, and you can switch between them instantly.

**Switching terminals:**
- Click on terminal tabs at the top
- Use keyboard shortcuts: `Ctrl+1` through `Ctrl+9`

### Grid View

Display multiple terminals side-by-side for monitoring parallel processes or comparing output.

**Available layouts:**
- **2x1** - Two terminals side-by-side
- **2x2** - Four terminals in a grid
- **3x1** - Three terminals horizontally
- **3x2** - Six terminals in a grid
- **3x3** - Nine terminals (maximum)

**Toggle grid view:**
- Press `Ctrl+Shift+G` to switch between tab and grid views
- Click the grid icon in the toolbar

### Resizable Grid Cells

In grid view, you can resize individual terminal cells by dragging the dividers between them. This lets you allocate more space to terminals that need it.

## Managing Terminals

### Creating Terminals

**New terminal:**
- Click the "+" button in the toolbar
- Press `Ctrl+Shift+T`

Each new terminal starts in the current project's working directory.

### Closing Terminals

**Close a terminal:**
- Click the "x" on the terminal tab
- Press `Ctrl+Shift+W` to close the active terminal
- Right-click a tab and select "Close"

### Renaming Terminals

Give terminals meaningful names to track what's running where.

**To rename:**
1. Right-click on a terminal tab
2. Select "Rename"
3. Enter a new name (e.g., "Dev Server", "Tests", "Build")

## Terminal State Indicators

Terminal tabs display color-coded indicators to show what's happening in each terminal:

- **Red pulse** (Processing): Claude Code is actively working — executing commands, reading files, or writing code
- **Cyan glow** (Plan Mode): Claude is in plan mode, designing an implementation approach before writing code
- **Green highlight** (Needs Attention): Claude has finished and is waiting for your input or approval
- **Red overlay** (Recording): Voice dictation is actively recording in this terminal

These indicators help you monitor multiple terminals at a glance, especially useful in grid view where you can see which terminals need your attention.

## Toolbar Customization

Customize which buttons appear in the terminal toolbar:

1. Go to **View > Toolbar Buttons** in the menu
2. Check or uncheck buttons to show or hide them
3. Changes take effect immediately

Hidden button preferences are saved in localStorage and persist across sessions.

### Grid Layout Selector

The toolbar includes a grid layout dropdown that lets you quickly switch between layouts (1x1, 2x1, 2x2, 3x1, 3x2, 3x3) without using keyboard shortcuts.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+T` | Create new terminal |
| `Ctrl+Shift+W` | Close active terminal |
| `Ctrl+1` - `Ctrl+9` | Switch to terminal 1-9 |
| `Ctrl+Shift+G` | Toggle grid view |

## Use Cases

**Development workflow:**
- Terminal 1: Run dev server
- Terminal 2: Watch tests
- Terminal 3: Git commands
- Terminal 4: Build/compile

**Multi-project monitoring:**
- Use grid view to watch logs from multiple services
- Resize cells to prioritize important output
- Name terminals by service (API, Frontend, Database)

## Tips

- Terminals keep running even when not visible
- Background terminals continue executing commands
- Use grid view during active development, tab view for focus
- Rename terminals immediately after creating them for better organization
