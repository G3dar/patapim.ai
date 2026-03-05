---
title: "Installation"
description: "How to install PATAPIM on your system"
order: 1
---

# Installation

This guide will walk you through installing PATAPIM on your system.

## Prerequisites

Before installing PATAPIM, ensure you have the following:

- **Windows 10 or later** (64-bit)
- **Node.js 18 or higher** — [Download from nodejs.org](https://nodejs.org/)
- **Git** — [Download from git-scm.com](https://git-scm.com/)
- **An AI CLI** — At least one of the following installed and authenticated:
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — `npm install -g @anthropic-ai/claude-code`
  - [Codex](https://github.com/openai/codex) — `npm install -g @openai/codex`
  - [Gemini CLI](https://github.com/google-gemini/gemini-cli) — `npm install -g @anthropic-ai/claude-code` *(check Gemini docs for latest install command)*

## Installation Methods

### Method 1: Install Script (Recommended)

Run one of these commands to download and install PATAPIM automatically:

**CMD:**
```
curl -fsSL https://raw.githubusercontent.com/G3dar/patapim-releases/main/install.cmd -o "%TEMP%\patapim-install.cmd" && "%TEMP%\patapim-install.cmd"
```

**PowerShell:**
```powershell
irm https://raw.githubusercontent.com/G3dar/patapim-releases/main/install.ps1 | iex
```

The install script handles downloading, extracting, and setting up PATAPIM automatically.

### Method 2: Download Installer

1. Visit the [PATAPIM download page](https://patapim.ai/download)
2. Click **Download Installer (.exe)**
3. Run the installer and follow the prompts
4. Launch PATAPIM from your applications menu or desktop shortcut

## macOS Support

macOS support is coming soon. Visit the [download page](https://patapim.ai/download) for the latest updates.

## Verifying Installation

After installation, verify PATAPIM is working correctly:

1. Launch PATAPIM
2. You should see the main window with the sidebar and terminal area
3. Open a new terminal (`Ctrl+Shift+T`)
4. Run a simple command like `node --version` to verify the terminal works
5. Test AI CLI integration by pressing `Ctrl+K` and typing a question

If you see a response from your AI CLI, your installation is complete.

## Troubleshooting

### PATAPIM won't start

- Ensure Node.js 18+ is installed: `node --version`
- Try running as administrator
- Check that your antivirus isn't blocking the application

### AI CLI not responding

- Verify your CLI is installed (e.g. `claude --version` or `codex --version`)
- Check that you're authenticated with the CLI
- Ensure you have an active internet connection

### Terminal not working

- Ensure you have a shell available (PowerShell, Git Bash, or WSL)
- Check Settings to verify the correct shell path is configured

## Next Steps

Now that PATAPIM is installed, head over to the [Quick Start Guide](./quick-start) to learn how to use it.
