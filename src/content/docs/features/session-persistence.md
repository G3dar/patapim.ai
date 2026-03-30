---
title: "Session Persistence"
description: "Terminal sessions saved per-project"
order: 10
---

## Overview

PATAPIM saves and restores terminal sessions per project. Close the app and reopen — your terminals are back where you left them.

## What Gets Saved

- Terminal sessions (working directory, shell)
- Active project
- Terminal state (`isProcessing`, `isPlanMode`, `needsAttention`)
- Claude Code session IDs (for session resume)

## Storage

Sessions stored at `~/.patapim/sessions.json`.

## Restore Behavior

On startup:
1. Last active project is restored
2. Terminal sessions for that project are re-created
3. Working directories are restored
4. Claude session IDs are preserved

A **10-second timeout** applies — if a session can't be restored in time, a fresh terminal is created.

## Claude Session Resume

PATAPIM detects the most recent Claude `.jsonl` session file and uses it for session resume. Sessions older than 7 days are skipped.
