---
title: "Task Management"
description: "Track and delegate tasks from within PATAPIM"
order: 5
---

# Task Management

PATAPIM includes a built-in task manager to track work, organize priorities, and delegate tasks to Claude Code without leaving your workspace.

## Task Panel

Access the task panel from the sidebar to view all tasks for the active project.

**Open task panel:**
- Click the task icon in the sidebar
- Press `Ctrl+Shift+T`

**Task panel shows:**
- All tasks for the current project
- Status indicators (pending, in progress, completed)
- Priority levels (high, medium, low)
- Task categories (feature, fix, refactor, docs, test)

## Task Structure

Each task has the following fields:

### Core Fields

**ID**: Unique identifier (auto-generated)
- Format: `task-1234567890`
- Used for tracking and references

**Title**: Short, action-oriented description
- Max 60 characters
- Example: "Add authentication to API"

**Description**: Detailed explanation
- What needs to be done
- How it should be done
- Which files are affected
- Technical notes

### Status & Priority

**Status**: Current state of the task
- `pending` - Not started
- `in_progress` - Currently working on it
- `completed` - Finished
- `paused` - Temporarily stopped

**Priority**: Importance level
- `high` - Critical, blocking work
- `medium` - Important, should do soon
- `low` - Nice to have, do when time allows

**Category**: Type of work
- `feature` - New functionality
- `fix` - Bug fix
- `refactor` - Code improvement
- `docs` - Documentation
- `test` - Test coverage

### Metadata

**Created**: When the task was created
**Updated**: When the task was last modified
**Completed**: When the task was marked complete (if applicable)

## Creating Tasks

### From Task Panel

1. Click "New Task" button
2. Fill in task details:
   - Title (required)
   - Description (required)
   - Priority (default: medium)
   - Category (default: feature)
3. Click "Create"

### Quick Create

For rapid task creation:
1. Click "Quick Add" in task panel
2. Type title and press Enter
3. Task created with default values
4. Edit later to add details

### From Context

Create tasks while working:
- Right-click a file → "Create Task"
- Highlight code → "Create Task from Selection"
- Task pre-filled with file path and context

## Task Actions

### Start Working

Click the "Start" button or press `Enter` on a pending task.

**What happens:**
- Status changes to `in_progress`
- Task moves to top of list
- Timestamp updated

### Complete Task

Click the "Complete" button when done.

**What happens:**
- Status changes to `completed`
- Completion timestamp recorded
- Task moves to completed section
- Toast notification appears

### Pause Task

Click "Pause" to temporarily stop work.

**Use cases:**
- Waiting for external dependency
- Blocked by another task
- Need to context switch

### Reopen Task

Click "Reopen" on a completed task to mark it as pending again.

**Use cases:**
- Bug reappeared
- Feature needs adjustment
- More work discovered

## Delegating to Claude Code

The killer feature: send tasks directly to Claude Code as prompts.

### How It Works

1. Select a task from the task panel
2. Click the play button (▶️) next to the task
3. PATAPIM sends the task description to Claude Code in the active terminal
4. Claude reads the task and starts working

**What gets sent:**
```
[Task from PATAPIM]
Title: Add authentication to API
Description: Implement JWT authentication for the API endpoints...
Priority: high
Category: feature

Please work on this task.
```

### When to Use

**Perfect for:**
- Complex refactoring tasks
- Feature implementation with clear specs
- Bug fixes with reproduction steps
- Code generation from requirements

**Not ideal for:**
- Vague or unclear tasks
- Tasks requiring design decisions
- Tasks needing human judgment

### Best Practices

**Write clear descriptions:**
- Specify acceptance criteria
- List affected files
- Note any constraints
- Provide examples

**Break down large tasks:**
- Split into subtasks
- Delegate one at a time
- Review before moving to the next

## Filtering Tasks

Filter tasks by status to focus on what matters.

**Filter options:**
- **All**: Show everything
- **Pending**: Not started
- **In Progress**: Currently working
- **Completed**: Finished
- **Paused**: Temporarily stopped

**Quick filters:**
- Press `1` - Show pending
- Press `2` - Show in progress
- Press `3` - Show completed
- Press `0` - Show all

## Toast Notifications

PATAPIM shows notifications for task events:

**Notifications appear for:**
- Task created
- Task completed
- Task status changed
- Task delegated to Claude Code
- Errors (duplicate task, missing fields)

**Notification position:**
- Bottom-right corner
- Auto-dismiss after 3 seconds
- Click to dismiss immediately

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+T` | Open task panel |
| `Ctrl+N` | New task |
| `Enter` | Start selected task |
| `Space` | Toggle task complete |
| `Delete` | Delete selected task |
| `↑` / `↓` | Navigate tasks |
| `1` / `2` / `3` | Filter by status |

## Integration with tasks.json

PATAPIM stores tasks in `tasks.json` at the project root.

**Format:**
```json
{
  "tasks": [
    {
      "id": "task-1234567890",
      "title": "Add authentication",
      "description": "Implement JWT auth...",
      "status": "in_progress",
      "priority": "high",
      "category": "feature",
      "createdAt": "2026-02-06T10:00:00Z",
      "updatedAt": "2026-02-06T10:30:00Z",
      "completedAt": null
    }
  ]
}
```

**Benefits:**
- Tasks version controlled with your code
- Share tasks with team via Git
- Edit tasks in any text editor
- Import/export tasks easily

## Tips

**Use descriptive titles:**
- ✅ "Fix login redirect loop"
- ❌ "Fix bug"

**Add context in descriptions:**
- What's broken or missing
- Steps to reproduce (for bugs)
- Acceptance criteria
- Technical approach

**Set realistic priorities:**
- Not everything is high priority
- Reserve high for critical/blocking work
- Most tasks should be medium

**Delegate intentionally:**
- Review task description before delegating
- Make sure it's clear enough for Claude
- Stay present while Claude works

**Archive completed tasks:**
- Completed tasks stay in the list
- Delete old tasks to reduce clutter
- Export tasks.json before deleting
