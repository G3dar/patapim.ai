---
title: "tasks.json Reference"
description: "Complete reference for the tasks.json task tracking file"
order: 5
---

# tasks.json Reference

`tasks.json` is a structured task tracking file that works with PATAPIM and Claude Code to manage project tasks, feature requests, and deferred work.

## Purpose

`tasks.json` provides:

- **Structured task tracking** - Track tasks with clear status, priority, and acceptance criteria
- **Context preservation** - Capture user requests and technical details
- **Claude Code integration** - Claude can read, create, and update tasks
- **PATAPIM UI integration** - View and manage tasks in the PATAPIM task panel

## File Location

```
<project-root>/tasks.json
```

## Structure

### Complete Example

```json
{
  "tasks": [
    {
      "id": "task-001",
      "title": "Add tasks button to terminal toolbar",
      "description": "Add a button to the terminal toolbar that opens the task panel. This will modify src/renderer/toolbar.js to add the button element and click handler. The button should use the existing task icon from assets/icons/.",
      "userRequest": "User said: Can you add a button to open the tasks panel?",
      "acceptanceCriteria": [
        "Button appears in terminal toolbar",
        "Button opens task panel when clicked",
        "Button uses task icon from assets"
      ],
      "notes": "User prefers button on right side of toolbar. Consider adding keyboard shortcut in future.",
      "status": "pending",
      "priority": "high",
      "category": "feature",
      "context": "Session on 2026-02-06 discussing task panel improvements",
      "createdAt": "2026-02-06T10:30:00Z",
      "updatedAt": "2026-02-06T10:30:00Z",
      "completedAt": null
    },
    {
      "id": "task-002",
      "title": "Fix terminal scrolling bug on Windows",
      "description": "Terminal doesn't auto-scroll to bottom when new output appears on Windows. Issue is in src/renderer/terminal.js scrollToBottom() function - needs to account for Windows scrollbar differences.",
      "userRequest": "User said: The terminal doesn't scroll down automatically on Windows",
      "acceptanceCriteria": [
        "Terminal auto-scrolls to bottom on new output",
        "Behavior works on Windows 10 and 11",
        "No regressions on macOS/Linux"
      ],
      "notes": "Tested on Windows 11. May be related to Electron version upgrade.",
      "status": "in_progress",
      "priority": "high",
      "category": "fix",
      "context": "Bug reported during Windows testing session",
      "createdAt": "2026-02-05T14:20:00Z",
      "updatedAt": "2026-02-06T09:15:00Z",
      "completedAt": null
    },
    {
      "id": "task-003",
      "title": "Refactor IPC handlers to use async/await",
      "description": "Current IPC handlers use callbacks which makes error handling difficult. Refactor all handlers in src/main/ to use async/await pattern. Update shared/ipcChannels.js documentation.",
      "userRequest": "User said: Let's modernize the IPC code to use async/await",
      "acceptanceCriteria": [
        "All IPC handlers use async/await",
        "Error handling uses try/catch",
        "No functionality regressions",
        "STRUCTURE.json updated"
      ],
      "notes": "This will make error handling more consistent. Do this before adding new IPC channels.",
      "status": "completed",
      "priority": "medium",
      "category": "refactor",
      "context": "Code quality improvement session",
      "createdAt": "2026-02-04T11:00:00Z",
      "updatedAt": "2026-02-05T16:30:00Z",
      "completedAt": "2026-02-05T16:30:00Z"
    }
  ]
}
```

## Schema Reference

### Task Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier (e.g., "task-001", "feature-auth") |
| `title` | string | ✅ | Short, action-oriented title (max 60 characters) |
| `description` | string | ✅ | Detailed technical explanation (what, how, which files) |
| `userRequest` | string | ✅ | Exact copy of user's original request |
| `acceptanceCriteria` | array | ✅ | List of concrete completion criteria |
| `notes` | string | ❌ | Additional notes, alternatives, decisions |
| `status` | string | ✅ | `"pending"`, `"in_progress"`, or `"completed"` |
| `priority` | string | ✅ | `"high"`, `"medium"`, or `"low"` |
| `category` | string | ✅ | `"feature"`, `"fix"`, `"refactor"`, `"docs"`, or `"test"` |
| `context` | string | ❌ | Session date and context when task was created |
| `createdAt` | string | ✅ | ISO 8601 timestamp |
| `updatedAt` | string | ✅ | ISO 8601 timestamp |
| `completedAt` | string/null | ✅ | ISO 8601 timestamp or null |

## Field Guidelines

### title

**Format:** Short, action-oriented (max 60 characters)

✅ **Good examples:**
- "Add tasks button to terminal toolbar"
- "Fix terminal scrolling bug on Windows"
- "Refactor IPC handlers to use async/await"

❌ **Bad examples:**
- "Tasks" (too vague)
- "Fix bug" (not specific)
- "Add a comprehensive task management system with filtering, sorting, and priority indicators to the terminal toolbar" (too long)

### description

**Format:** Technical explanation with what, how, and which files (minimum 2-3 sentences)

**Must include:**
- What will be done
- How it will be done (brief technical approach)
- Which files will be affected

**Example:**

```
Add a button to the terminal toolbar that opens the task panel. This will
modify src/renderer/toolbar.js to add the button element and click handler.
The button should use the existing task icon from assets/icons/.
```

### userRequest

**Format:** Exact copy of user's words in "User said: ..." format

**Purpose:** Preserve original context

**Example:**

```
User said: Can you add a button to open the tasks panel?
```

### acceptanceCriteria

**Format:** Array of concrete, testable completion criteria

**Each criterion should be:**
- Specific and measurable
- Testable
- Focused on outcomes, not implementation

**Example:**

```json
"acceptanceCriteria": [
  "Button appears in terminal toolbar",
  "Button opens task panel when clicked",
  "Button uses task icon from assets",
  "Keyboard shortcut Ctrl+T also opens panel"
]
```

### status

**Values:**

| Status | Description | When to use |
|--------|-------------|-------------|
| `pending` | Not started | Task created but work hasn't begun |
| `in_progress` | Currently being worked on | Task is actively being developed |
| `completed` | Finished | Task is done and acceptance criteria met |

**Status transitions:**

```
pending → in_progress → completed
```

### priority

**Values:**

| Priority | Description | Examples |
|----------|-------------|----------|
| `high` | Urgent, blocking, or critical | Bug fixes, critical features, blockers |
| `medium` | Important but not urgent | Most features, improvements |
| `low` | Nice to have | Minor enhancements, future ideas |

### category

**Values:**

| Category | Description | Examples |
|----------|-------------|----------|
| `feature` | New functionality | Add task panel, implement search |
| `fix` | Bug fixes | Fix scrolling bug, resolve crash |
| `refactor` | Code improvements | Refactor IPC handlers, simplify logic |
| `docs` | Documentation | Update README, add API docs |
| `test` | Testing | Add unit tests, integration tests |

## Task Creation Rules

### When to Create Tasks

**Create tasks when:**

- User requests a feature or change
- User makes a decision: "Let's do this", "Let's add this"
- Work is deferred: "We'll do this later", "Let's leave it for now"
- Improvements discovered while coding
- Bugs identified that need fixing

**Don't create tasks for:**

- Error messages and debugging (unless a bug is confirmed)
- Questions and explanations
- Temporary experiments
- Work already completed
- Instant fixes (typos, minor corrections)

### Creation Workflow

1. **Detect task pattern** during conversation
2. **Ask user** at appropriate moment: "I identified these tasks from our conversation, should I add them to tasks.json?"
3. **User approves** → Add to tasks.json
4. **Generate task object** with all required fields

## Usage Examples

### Example: Creating a Task

User says: "Can we add a dark mode toggle to the settings?"

Claude responds:

```
I can add a dark mode toggle to the settings panel. This would involve:
- Adding a toggle switch to src/renderer/settings.js
- Storing the theme preference in localStorage
- Applying theme classes to the body element

Should I add this as a task to tasks.json?
```

User: "Yes"

Claude creates:

```json
{
  "id": "task-004",
  "title": "Add dark mode toggle to settings",
  "description": "Add a toggle switch to the settings panel for dark mode. This will modify src/renderer/settings.js to add the toggle UI element, store the theme preference in localStorage, and apply theme classes to the body element. CSS changes needed in src/renderer/styles.css.",
  "userRequest": "User said: Can we add a dark mode toggle to the settings?",
  "acceptanceCriteria": [
    "Toggle appears in settings panel",
    "Clicking toggle switches between light and dark theme",
    "Theme preference persists across sessions",
    "Dark theme styles applied correctly"
  ],
  "notes": "",
  "status": "pending",
  "priority": "medium",
  "category": "feature",
  "context": "Session on 2026-02-06 discussing UI improvements",
  "createdAt": "2026-02-06T11:00:00Z",
  "updatedAt": "2026-02-06T11:00:00Z",
  "completedAt": null
}
```

### Example: Updating Task Status

When starting work:

```json
{
  "id": "task-004",
  "status": "in_progress",
  "updatedAt": "2026-02-06T11:30:00Z"
}
```

When completing:

```json
{
  "id": "task-004",
  "status": "completed",
  "updatedAt": "2026-02-06T12:15:00Z",
  "completedAt": "2026-02-06T12:15:00Z"
}
```

## Integration with PATAPIM

### Task Panel UI

PATAPIM displays tasks in a visual panel:

- **Filter by status** - Show pending/in-progress/completed
- **Filter by category** - Show only features/fixes/etc.
- **Sort by priority** - High priority tasks first
- **Click to view details** - See full description and acceptance criteria
- **Update status** - Click buttons to move task through workflow

### Keyboard Shortcuts

- `Ctrl+Shift+T` - Toggle task panel
- Click task → View details
- Right-click task → Update status

### File Watching

PATAPIM watches `tasks.json` for changes:

- Auto-refreshes task panel when file changes
- Claude can edit tasks.json, UI updates automatically
- Manual edits also trigger refresh

## Best Practices

### ✅ Do

- **Be specific in titles** - Action-oriented, clear
- **Include technical details** - What, how, which files
- **Copy user's exact words** - In userRequest field
- **Write testable criteria** - Concrete, measurable
- **Update status promptly** - Keep status current
- **Add notes** - Capture important decisions or alternatives

### ❌ Don't

- **Don't create empty tasks** - All required fields must be filled
- **Don't duplicate tasks** - Check existing tasks first
- **Don't forget to update status** - Stale status misleads
- **Don't skip acceptance criteria** - How do we know it's done?
- **Don't use vague descriptions** - Be specific about implementation

## Related Files

- **CLAUDE.md** - Contains task management rules and workflow
- **PROJECT_NOTES.md** - Can reference completed tasks
- **STRUCTURE.json** - May be updated as part of task completion
- **.patapim/config.json** - Can configure custom task file location

## CLI Integration

### View Tasks

```bash
# View all pending tasks
cat tasks.json | jq '.tasks[] | select(.status == "pending")'

# Count tasks by status
cat tasks.json | jq '.tasks | group_by(.status) | map({status: .[0].status, count: length})'
```

### Update Task Status

```bash
# Mark task as in-progress (requires jq)
jq '(.tasks[] | select(.id == "task-004") | .status) = "in_progress"' tasks.json > tmp.json && mv tmp.json tasks.json
```

## Template

Minimal `tasks.json` template:

```json
{
  "tasks": []
}
```

Task template:

```json
{
  "id": "task-XXX",
  "title": "",
  "description": "",
  "userRequest": "User said: ",
  "acceptanceCriteria": [],
  "notes": "",
  "status": "pending",
  "priority": "medium",
  "category": "feature",
  "context": "",
  "createdAt": "",
  "updatedAt": "",
  "completedAt": null
}
```
