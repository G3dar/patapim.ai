---
title: "STRUCTURE.json Reference"
description: "Complete reference for the STRUCTURE.json module map"
order: 4
---

# STRUCTURE.json Reference

`STRUCTURE.json` is a comprehensive map of your codebase that helps Claude Code quickly understand your project structure, module dependencies, and architecture patterns.

## Purpose

`STRUCTURE.json` serves as:

- **Module directory** - Quick reference to what each file does
- **Dependency map** - Shows which modules depend on each other
- **IPC channel registry** - Documents communication between processes (for Electron apps)
- **Architecture notes** - Captures important patterns and solutions

## File Location

```
<project-root>/STRUCTURE.json
```

## Structure

### Complete Example

```json
{
  "modules": {
    "main/tasksManager": {
      "path": "src/main/tasksManager.js",
      "purpose": "Task CRUD operations - load, add, update, delete tasks",
      "exports": ["init", "loadTasks", "addTask", "updateTask", "deleteTask"],
      "depends": ["fs", "path", "shared/ipcChannels"]
    },
    "renderer/taskPanel": {
      "path": "src/renderer/taskPanel.js",
      "purpose": "UI component for displaying and managing tasks",
      "exports": ["renderTaskPanel", "updateTaskList"],
      "depends": ["shared/ipcChannels", "renderer/components"]
    },
    "shared/ipcChannels": {
      "path": "src/shared/ipcChannels.js",
      "purpose": "IPC channel name constants shared between main and renderer",
      "exports": ["LOAD_TASKS", "ADD_TASK", "UPDATE_TASK"],
      "depends": []
    }
  },
  "ipcChannels": {
    "LOAD_TASKS": {
      "direction": "renderer → main",
      "handler": "main/tasksManager.js",
      "description": "Load all tasks from tasks.json"
    },
    "ADD_TASK": {
      "direction": "renderer → main",
      "handler": "main/tasksManager.js",
      "description": "Add a new task to tasks.json"
    },
    "TASKS_UPDATED": {
      "direction": "main → renderer",
      "handler": "renderer/taskPanel.js",
      "description": "Notify renderer when tasks have changed"
    }
  },
  "architectureNotes": {
    "circularDependencies": {
      "issue": "taskPanel and taskManager had circular dependency",
      "solution": "Extracted shared constants to shared/ipcChannels.js"
    },
    "stateManagement": {
      "pattern": "Main process is source of truth for tasks, renderer requests updates via IPC"
    }
  }
}
```

## Schema Reference

### modules

A map of all modules in your codebase.

**Key:** Module identifier (usually `folder/filename` without extension)

**Value object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | ✅ | Relative path to the file from project root |
| `purpose` | string | ✅ | Clear description of what this module does |
| `exports` | array | ✅ | List of exported functions/classes |
| `depends` | array | ✅ | List of modules this one depends on (use module keys) |

**Example:**

```json
"main/projectManager": {
  "path": "src/main/projectManager.js",
  "purpose": "Manages project loading, saving, and workspace state",
  "exports": ["loadProject", "saveProject", "getRecentProjects"],
  "depends": ["fs", "path", "electron", "main/windowManager"]
}
```

### ipcChannels

Registry of IPC (Inter-Process Communication) channels for Electron apps.

**Key:** Channel name constant (usually uppercase)

**Value object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `direction` | string | ✅ | `"renderer → main"`, `"main → renderer"`, or `"bidirectional"` |
| `handler` | string | ✅ | Module key that handles this channel |
| `description` | string | ❌ | What this channel does |

**Example:**

```json
"OPEN_PROJECT": {
  "direction": "renderer → main",
  "handler": "main/projectManager.js",
  "description": "Request to open a project by path"
}
```

### architectureNotes

Free-form documentation of important architectural decisions and patterns.

**Key:** Note identifier (descriptive name)

**Value:** Any structure that captures the information

**Common patterns:**

```json
"architectureNotes": {
  "circularDependencies": {
    "issue": "Description of the problem",
    "solution": "How it was solved"
  },
  "stateManagement": {
    "pattern": "Description of the pattern used"
  },
  "errorHandling": {
    "approach": "Centralized error handler in main/errorHandler.js",
    "reason": "Consistent error reporting across all IPC handlers"
  }
}
```

## Auto-Update

### Pre-Commit Hook

PATAPIM includes a pre-commit hook that automatically updates `STRUCTURE.json` before each commit.

**Setup:**

```bash
# Install Husky (if not already installed)
npm install husky --save-dev
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run structure"
```

**How it works:**

1. You run `git commit`
2. Pre-commit hook runs `npm run structure`
3. Script analyzes your codebase and updates STRUCTURE.json
4. Updated STRUCTURE.json is included in the commit

### Manual Update

You can manually regenerate `STRUCTURE.json`:

```bash
npm run structure
```

This runs the structure generator script, which:

- Scans all files in `src/`
- Extracts exports and imports
- Updates module entries
- Preserves `architectureNotes` section

## When to Update

### Automatically Updated

These changes trigger auto-update via pre-commit hook:

- New file created
- File deleted or moved
- Exports added/removed
- Imports (dependencies) changed

### Manual Update Required

These require editing STRUCTURE.json manually:

- **Adding IPC channels** - New channel created
- **Updating purpose** - Module purpose description needs improvement
- **Adding architecture notes** - Documenting a new pattern or decision

### Update Workflow

1. **Make code changes** (add file, export function, etc.)
2. **Run `npm run structure`** (or rely on pre-commit hook)
3. **Review STRUCTURE.json** - Check that auto-generated entries are correct
4. **Add manual sections** - Add IPC channels or architecture notes if needed
5. **Commit**

## Best Practices

### ✅ Do

- **Keep purpose concise** - One clear sentence
- **Use module keys for dependencies** - Reference other modules by their key (e.g., `"main/tasksManager"`)
- **Document IPC channels** - Essential for understanding Electron apps
- **Add architecture notes** - Capture important decisions when they happen
- **Run structure generator regularly** - Keep it in sync with code

### ❌ Don't

- **Don't skip updates** - Outdated STRUCTURE.json misleads Claude
- **Don't duplicate code** - STRUCTURE.json describes modules, not implements them
- **Don't over-document** - Focus on exports and dependencies, not implementation details
- **Don't manually maintain everything** - Use the generator for module entries

## Example: Adding a New Module

**1. Create the file:**

```javascript
// src/main/settingsManager.js
const fs = require('fs');
const path = require('path');

function loadSettings() { /* ... */ }
function saveSettings() { /* ... */ }

module.exports = { loadSettings, saveSettings };
```

**2. Run structure generator:**

```bash
npm run structure
```

**3. STRUCTURE.json is updated:**

```json
"modules": {
  "main/settingsManager": {
    "path": "src/main/settingsManager.js",
    "purpose": "Auto-generated description",
    "exports": ["loadSettings", "saveSettings"],
    "depends": ["fs", "path"]
  }
}
```

**4. Improve the purpose manually:**

```json
"main/settingsManager": {
  "path": "src/main/settingsManager.js",
  "purpose": "Load and save user settings from config.json",
  "exports": ["loadSettings", "saveSettings"],
  "depends": ["fs", "path"]
}
```

## Example: Adding IPC Channels

When you add a new IPC channel:

**1. Define the channel:**

```javascript
// src/shared/ipcChannels.js
module.exports = {
  LOAD_TASKS: 'load-tasks',
  SAVE_SETTINGS: 'save-settings', // NEW
};
```

**2. Manually update STRUCTURE.json:**

```json
"ipcChannels": {
  "SAVE_SETTINGS": {
    "direction": "renderer → main",
    "handler": "main/settingsManager.js",
    "description": "Save user settings to config.json"
  }
}
```

## Integration with CLAUDE.md

`CLAUDE.md` references `STRUCTURE.json` as a key project navigation file:

```markdown
## 🧭 Project Navigation

**Read these files at the start of each session:**

1. **STRUCTURE.json** - Module map, which file is where
```

This tells Claude to read STRUCTURE.json at the beginning of each session to understand the codebase.

## Generator Script

Create a structure generator script:

```javascript
// scripts/generateStructure.js
const fs = require('fs');
const path = require('path');

function scanModules() {
  // Scan src/ directory
  // Extract exports and imports
  // Generate modules object
}

function preserveManualSections(oldStructure, newStructure) {
  // Preserve ipcChannels and architectureNotes
  newStructure.ipcChannels = oldStructure.ipcChannels || {};
  newStructure.architectureNotes = oldStructure.architectureNotes || {};
  return newStructure;
}

function main() {
  const oldStructure = JSON.parse(fs.readFileSync('STRUCTURE.json', 'utf8'));
  const newModules = scanModules();
  const newStructure = preserveManualSections(oldStructure, { modules: newModules });

  fs.writeFileSync('STRUCTURE.json', JSON.stringify(newStructure, null, 2));
  console.log('STRUCTURE.json updated');
}

main();
```

**Add to package.json:**

```json
{
  "scripts": {
    "structure": "node scripts/generateStructure.js"
  }
}
```

## Related Files

- **CLAUDE.md** - References STRUCTURE.json in Project Navigation section
- **package.json** - Contains `npm run structure` script
- **.husky/pre-commit** - Runs structure generator before commits
- **PROJECT_NOTES.md** - Can reference architecture notes from STRUCTURE.json

## Template

Minimal `STRUCTURE.json` template:

```json
{
  "modules": {
    "main/index": {
      "path": "src/main/index.js",
      "purpose": "Main process entry point",
      "exports": [],
      "depends": ["electron"]
    }
  },
  "ipcChannels": {},
  "architectureNotes": {}
}
```
