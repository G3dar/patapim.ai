---
title: "Session Persistence"
description: "Terminal sessions saved per-project"
order: 10
---

# Session Persistence

PATAPIM automatically saves your terminal sessions per project, allowing you to pick up exactly where you left off. Terminal state, command history, and logs are preserved across application restarts.

## How Session Persistence Works

Session persistence is fully automatic. No configuration or manual saving is required.

When you:
- Run commands in the terminal
- Switch between projects
- Close and reopen PATAPIM

Your terminal state is automatically saved and restored.

## Per-Project Sessions

Each project has its own isolated terminal session:

- **Working directory**: Saved per project
- **Environment variables**: Project-specific env vars are preserved
- **Command history**: Each project maintains its own history
- **Active terminal tabs**: Number and state of terminal tabs restored

When you switch between projects in PATAPIM, the terminal state automatically switches to match the selected project.

### Example

```
Project A:
  - Working directory: /home/user/project-a
  - Command history: npm install, npm start, git status
  - 2 terminal tabs open

Project B:
  - Working directory: /home/user/project-b
  - Command history: python manage.py runserver, pytest
  - 1 terminal tab open
```

Switching from Project A to Project B automatically restores Project B's terminal state.

## Terminal Logs

All terminal output is saved to dated log files for later review.

### Log File Location

Logs are stored in your system's application data directory:

**Windows**:
```
C:\Users\<username>\AppData\Roaming\patapim\logs\
```

**macOS**:
```
~/Library/Application Support/patapim/logs/
```

**Linux**:
```
~/.config/patapim/logs/
```

### Log File Format

Log files are named by date and project:

```
2026-02-06_project-name_terminal-1.log
2026-02-06_project-name_terminal-2.log
```

Each terminal tab gets its own log file.

### Log Contents

Log files contain:
- All command input
- All command output (stdout and stderr)
- Timestamps for each entry
- Terminal control sequences (colors, formatting)

You can view logs as plain text or with a terminal that interprets ANSI codes.

## Log Retention

PATAPIM automatically manages log file storage:

- **Retention period**: 30 days
- **Automatic cleanup**: Logs older than 30 days are deleted on startup
- **Manual cleanup**: You can manually delete logs from the logs directory

This prevents log files from accumulating indefinitely while preserving recent session history.

### Changing Retention Period

To change the log retention period:

1. Open PATAPIM settings
2. Navigate to **Terminal > Session Logs**
3. Adjust the "Log retention days" setting
4. Click "Save"

Set to `0` to disable automatic log deletion (not recommended for active projects).

## Command History

Command history is saved per project and persists across sessions:

- **Up/Down arrows**: Navigate command history
- **Ctrl+R**: Search command history
- **History size**: Last 1000 commands per project (configurable)

Command history is saved immediately after each command execution, so you won't lose history even if PATAPIM crashes.

## Restoring Sessions After Crash

If PATAPIM crashes or is force-closed:

1. Terminal state is restored from the last saved checkpoint
2. Command history is fully preserved
3. Terminal logs are intact
4. You can resume where you left off

PATAPIM saves session state every 5 seconds and after each command execution, minimizing data loss.

## Privacy and Storage

Session persistence stores data locally on your machine:

- No data is sent to external servers
- Logs may contain sensitive information (API keys, passwords in command output)
- Consider the 30-day retention period when working with sensitive data

To disable session persistence:

1. Open PATAPIM settings
2. Navigate to **Terminal > Session Persistence**
3. Uncheck "Enable session persistence"
4. Click "Save"

Note: Disabling session persistence will prevent terminal state from being saved across restarts.
