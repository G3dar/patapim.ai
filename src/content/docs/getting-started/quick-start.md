---
title: "Quick Start"
description: "Get up and running with PATAPIM in 5 minutes"
order: 2
---

# Quick Start

Get productive with PATAPIM in just a few minutes. This guide covers the essentials to start developing with Claude Code.

## First Launch

When you first launch PATAPIM, you'll see:

- **Sidebar** on the left with project management, file tree, and settings
- **Terminal area** in the center where your terminals will appear
- **Status bar** at the bottom showing connection status and shortcuts

## Creating a Project

1. Click the **Projects** button in the sidebar (or press Ctrl+P)
2. Click **Add Project**
3. Select a folder on your system
4. Give your project a name
5. Click **Create**

Your project will now appear in the sidebar, and the file tree will show your project's files.

## Opening a Terminal

PATAPIM supports up to 9 terminals in a grid layout:

- **New terminal**: Press `Ctrl+Shift+T` (or `Cmd+Shift+T` on macOS)
- **Switch terminals**: Press `Ctrl+1` through `Ctrl+9` to jump to a specific terminal
- **Close terminal**: Press `Ctrl+Shift+W` or click the X button on the terminal tab

The terminal opens in your project's root directory by default.

## Running Claude Code

PATAPIM has deep integration with Claude Code CLI:

### Quick Ask (Ctrl+K)

Press `Ctrl+K` (or `Cmd+K` on macOS) to open the Claude Code quick ask dialog:

1. Type your question or request
2. Press Enter
3. Claude's response appears in the terminal

Example: "Create a Python script that reads a CSV file"

### Full Claude Code Session

Run Claude Code directly in any terminal:

```bash
claude
```

This starts an interactive session where you can have a conversation with Claude about your code.

## Basic Navigation

### Sidebar

- **Projects**: Manage your projects (Ctrl+P)
- **File Tree**: Browse and open files (click to open in your default editor)
- **Tasks**: View and manage tasks from tasks.json (Ctrl+Shift+B)
- **Settings**: Configure PATAPIM preferences

### File Tree

- Click any file to open it in your default editor
- Right-click for context menu (open folder, reveal in explorer, etc.)
- Use the search bar to filter files

### Terminal Grid

- Drag terminal tabs to reorder them
- Click the grid icon to change layout (1x1, 2x2, 3x3)
- Each terminal runs independently

## Essential Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+T` | Open new terminal |
| `Ctrl+Shift+W` | Close current terminal |
| `Ctrl+K` | Claude Code quick ask |
| `Ctrl+1-9` | Switch to terminal 1-9 |
| `Ctrl+P` | Open projects panel |
| `Ctrl+Shift+B` | Open tasks panel |
| `Ctrl+,` | Open settings |
| `Ctrl+Alt+M` | Toggle voice dictation |

*Replace Ctrl with Cmd on macOS*

## Working with Claude Code

Here are some common workflows:

### Ask Claude for help

```bash
# Quick ask with Ctrl+K
"How do I read a JSON file in Python?"

# Or in a full session
claude
> Read the config.json file and explain its structure
```

### Generate code

```bash
claude
> Create a React component for a login form with email and password fields
```

### Debug code

```bash
claude
> This script is giving me an error, can you help debug it?
```

### Refactor code

```bash
claude
> Refactor this function to use async/await instead of promises
```

## Voice Dictation

PATAPIM includes voice dictation powered by Whisper:

1. Press `Ctrl+Alt+M` to start recording
2. Speak your command or question
3. Press `Ctrl+Alt+M` again to stop and transcribe
4. The text appears in the active terminal or Claude Code prompt

Great for hands-free coding or when you're away from the keyboard.

## Remote Access

PATAPIM can be accessed remotely via WebSocket and Cloudflare tunnels:

1. Go to Settings > Remote Access
2. Enable remote access
3. Copy the provided URL
4. Open the URL on any device with a web browser
5. Authenticate with PassKey

Your terminals, file tree, and Claude Code integration are accessible from anywhere.

## Next Steps

Now that you're familiar with the basics:

- Explore [System Requirements](./system-requirements) to optimize performance
- Check out the [Features Guide](../features) to learn about advanced capabilities
- Read about [Task Management](../features/task-management) to organize your work
- Learn about [Plugin System](../features/plugin-system) to extend PATAPIM

## Tips for Productivity

- Use keyboard shortcuts to navigate quickly
- Keep related terminals in a grid layout for comparison
- Use Claude Code for repetitive tasks (generating boilerplate, writing tests)
- Enable voice dictation when documenting your code
- Set up remote access to continue work from anywhere
- Leverage the task management system to track TODOs

Happy coding with PATAPIM and Claude Code!
