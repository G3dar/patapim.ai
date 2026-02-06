---
title: "Installation"
description: "How to install PATAPIM on your system"
order: 1
---

# Installation

This guide will walk you through installing PATAPIM on your system.

## Prerequisites

Before installing PATAPIM, ensure you have the following installed:

- **Node.js 18 or higher** - [Download from nodejs.org](https://nodejs.org/)
- **Git** - [Download from git-scm.com](https://git-scm.com/)
- **Claude Code CLI** - Install and authenticate with Anthropic

### Installing Claude Code CLI

If you haven't already installed the Claude Code CLI:

```bash
npm install -g @anthropic-ai/claude-code
```

Authenticate with your Anthropic API key:

```bash
claude-code auth
```

## Installation Methods

### Method 1: Download Installer (Recommended)

1. Visit the [PATAPIM releases page](https://github.com/yourusername/patapim/releases)
2. Download the installer for your platform:
   - Windows: `PATAPIM-Setup-x.x.x.exe`
   - macOS: `PATAPIM-x.x.x.dmg`
   - Linux: `PATAPIM-x.x.x.AppImage`
3. Run the installer and follow the prompts
4. Launch PATAPIM from your applications menu

### Method 2: Install from Source

Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/patapim.git
cd patapim
npm install
```

Start PATAPIM:

```bash
npm start
```

## Verifying Installation

After installation, verify PATAPIM is working correctly:

1. Launch PATAPIM
2. You should see the main window with the sidebar and terminal area
3. Open a new terminal (Ctrl+Shift+T or Cmd+Shift+T)
4. Run a simple command like `pwd` to verify the terminal works
5. Test Claude Code integration by pressing Ctrl+K (or Cmd+K) and typing a question

If you see the Claude Code response, your installation is complete.

## Troubleshooting

### PATAPIM won't start

- Ensure Node.js 18+ is installed: `node --version`
- Check that all dependencies are installed: `npm install`
- Try running with debug mode: `PATAPIM_DEBUG=1 npm start`

### Claude Code not responding

- Verify Claude Code CLI is installed: `claude-code --version`
- Check authentication: `claude-code auth`
- Ensure you have an active internet connection

### Terminal not working

- On Windows, ensure you have a shell installed (PowerShell, Git Bash, or WSL)
- On macOS/Linux, verify your default shell is configured: `echo $SHELL`

## Next Steps

Now that PATAPIM is installed, head over to the [Quick Start Guide](./quick-start) to learn how to use it.
