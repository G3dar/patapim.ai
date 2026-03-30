---
title: "tasks.json Reference"
description: "Complete reference for the tasks.json task tracking file"
order: 5
---

## What is tasks.json?

tasks.json is a task tracking file in your project root that syncs with PATAPIM's built-in task panel.

## Format

```json
{
  "tasks": [
    {
      "id": "a1b2c3d4",
      "text": "Fix authentication flow in login module",
      "status": "in_progress",
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-01-15T14:30:00.000Z"
    }
  ]
}
```

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (UUID) |
| `text` | string | Task description |
| `status` | string | Current status |
| `createdAt` | string | ISO 8601 creation timestamp |
| `updatedAt` | string | ISO 8601 last update timestamp |

## Status Values

```
pending → in_progress → ready_to_test → completed
```

| Status | Meaning |
|--------|---------|
| `pending` | Task created, not yet started |
| `in_progress` | Currently being worked on |
| `ready_to_test` | Implementation done, needs testing |
| `completed` | Task finished |

## Task Panel

PATAPIM's task panel reads and writes tasks.json:

- **Filter** by status: All, Pending, In Progress, Completed
- **Add** tasks via the panel or quick task overlay
- **Update** status with click
- **Delete** and **reorder** tasks
- **Send to terminal**: Click play to send task text to active terminal
