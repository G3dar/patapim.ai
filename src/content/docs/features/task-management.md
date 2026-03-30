---
title: "Task Management"
description: "Track and delegate tasks from within PATAPIM"
order: 5
---

## Overview

Built-in task panel synced with `tasks.json` in your project root.

## Task Format

```json
{ "tasks": [{ "id": "uuid", "text": "description", "status": "pending", "createdAt": "ISO", "updatedAt": "ISO" }] }
```

## Status Flow

`pending` → `in_progress` → `ready_to_test` → `completed`

## Task Panel

- Filter by status: All, Pending, In Progress, Completed
- Add, update, delete, reorder tasks
- **Play button**: Sends task text to active terminal as a prompt
- Quick task overlay for rapid input (text or voice)

## AI Integration

Claude Code can detect tasks in conversations and suggest saving them. User approval always required.
