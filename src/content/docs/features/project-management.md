---
title: "Project Management"
description: "Manage all your projects in one workspace"
order: 4
---

# Project Management

PATAPIM lets you manage multiple projects in a single workspace. Switch between projects instantly, explore files, and keep your work organized.

## Workspace Concept

Your **workspace** is a collection of projects you're actively working on. Each project:
- Has its own folder path
- Can be opened in the file explorer
- Appears in the sidebar for quick access
- Retains its own terminal working directory

**Benefits:**
- No need to close and reopen projects
- Switch context in one click
- See all your work in one place
- Terminals inherit project paths

## Adding Projects

### Add a Project

1. Click the "+" button in the sidebar
2. Browse to select a folder
3. Project appears in the sidebar immediately

**Or use the menu:**
- File → Add Project to Workspace
- Right-click sidebar → Add Project

### What Qualifies as a Project?

Any folder can be a project:
- Git repositories
- Node.js apps
- Python projects
- Static websites
- Configuration folders
- Documentation repos

## File Explorer

### Collapsible Tree View

The file explorer shows your project structure as an expandable tree.

**Features:**
- **5-level depth limit**: Prevents performance issues with deep folders
- **Collapsible folders**: Click to expand/collapse
- **File icons**: Visual file type indicators
- **Click to open**: Opens files in your default editor

### Smart Filtering

PATAPIM automatically hides noise from your file tree.

**Filtered by default:**
- `node_modules` directories
- `.git` folders
- Build output folders
- Hidden files (`.env`, `.DS_Store`)

**Why?**
- Faster tree rendering
- Easier to find your source files
- Reduces visual clutter

**Show hidden files:**
- Click the filter icon in explorer toolbar
- Toggle "Show Hidden Files"

### Navigation

**Keyboard:**
- `↑` / `↓` - Move up/down
- `→` - Expand folder
- `←` - Collapse folder
- `Enter` - Open file

**Mouse:**
- Click folder to expand/collapse
- Click file to open
- Right-click for context menu

## Switching Projects

### Quick Switch

Click any project name in the sidebar to switch focus.

**What happens:**
- File explorer shows that project's files
- New terminals open in that project's directory
- Project is highlighted in sidebar

### Sidebar Organization

Projects are listed in the order you added them.

**Reorder projects:**
1. Right-click a project
2. Select "Move Up" or "Move Down"

## Removing Projects

### Remove from Workspace

**To remove a project:**
1. Right-click the project in the sidebar
2. Select "Remove from Workspace"

**Important:**
- This only removes it from PATAPIM
- Your files are NOT deleted
- You can add it back anytime

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` | Add project |
| `Ctrl+Shift+E` | Toggle file explorer |
| `Ctrl+Shift+F` | Focus project search |
| `↑` / `↓` | Navigate files/folders |
| `Enter` | Open selected file |

## Multi-Project Workflows

### Context Switching

**Frontend + Backend:**
- Project 1: React frontend
- Project 2: Node.js API
- Terminal 1: `npm run dev` (frontend)
- Terminal 2: `node server.js` (backend)

Switch projects to explore files while both services run.

### Microservices

**Multiple services:**
- Project 1: Auth service
- Project 2: User service
- Project 3: Payment service
- Grid view: Monitor logs from all three

### Client Work

**Multiple client projects:**
- Keep all active projects visible
- Switch context without closing anything
- Bill time more accurately by seeing all work

## Tips

**Organize by purpose:**
- Group related projects together
- Use meaningful project folder names
- Remove inactive projects to reduce clutter

**Use with terminals:**
- New terminals inherit the active project's path
- Switch projects before creating terminals
- Name terminals by project for clarity

**File explorer performance:**
- If a project has huge folders, it may slow down
- The 5-level depth limit helps prevent this
- Consider filtering large folders in settings

## Workspace Persistence

Your workspace configuration is saved automatically:
- Project list persists between sessions
- Folder expansion state remembered
- Active project restored on restart

**Fresh start:**
- Remove all projects to reset
- PATAPIM will show an empty sidebar
- Add projects as needed
