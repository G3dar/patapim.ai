---
title: "Installation"
description: "How to install PATAPIM on your system"
order: 1
---

# Installation

This guide will walk you through installing PATAPIM on your system.

## Prerequisites

Before installing PATAPIM, ensure you have the following:

- **Windows 10 or later** (64-bit) or **macOS 12+** (Intel or Apple Silicon)
- **Node.js 18 or higher** — [Download from nodejs.org](https://nodejs.org/)
- **Git** — [Download from git-scm.com](https://git-scm.com/)
- **An AI CLI** — At least one of the following installed and authenticated:
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — `npm install -g @anthropic-ai/claude-code`
  - [Codex](https://github.com/openai/codex) — `npm install -g @openai/codex`
  - [Gemini CLI](https://github.com/google-gemini/gemini-cli) — `npm install -g @google/gemini-cli`

## Windows Installation

### Method 1: Install Script (Recommended)

**CMD:**
```
curl -fsSL https://raw.githubusercontent.com/G3dar/patapim-releases/main/install.cmd -o "%TEMP%\patapim-install.cmd" && "%TEMP%\patapim-install.cmd"
```

**PowerShell:**
```powershell
irm https://raw.githubusercontent.com/G3dar/patapim-releases/main/install.ps1 | iex
```

### Method 2: Download Installer

1. Visit the [PATAPIM download page](https://patapim.ai/download)
2. Click **Download Installer (.exe)**
3. Run the installer and follow the prompts
4. Launch PATAPIM from your applications menu or desktop shortcut

## macOS Installation

### Method 1: Install Script (Recommended)

Open Terminal and run:

```bash
curl -fsSL https://raw.githubusercontent.com/G3dar/patapim-releases/main/install-mac.sh | bash
```

This automatically detects your Mac's architecture (Apple Silicon or Intel) and installs the correct version.

### Method 2: Download DMG

1. Visit the [PATAPIM download page](https://patapim.ai/download)
2. Click **Download for Apple Silicon** (M1/M2/M3/M4) or **Download for Intel** (older Macs)
3. Open the downloaded `.dmg` file
4. Drag **PATAPIM** to your **Applications** folder
5. Launch PATAPIM from Applications or Launchpad

> **Note:** On first launch, macOS may show a security warning. Right-click PATAPIM and select "Open" to bypass Gatekeeper, or go to System Settings > Privacy & Security and click "Open Anyway".

### macOS Prerequisites

Ensure Xcode Command Line Tools are installed:

```bash
xcode-select --install
```

## Verifying Installation

After installation, verify PATAPIM is working correctly:

1. Launch PATAPIM
2. You should see the main window with the sidebar and terminal area
3. Open a new terminal (`Ctrl+Shift+T` on Windows, `Cmd+Shift+T` on macOS)
4. Run a simple command like `node --version` to verify the terminal works
5. Test AI CLI integration by pressing `Ctrl+K` / `Cmd+K` and typing a question

If you see a response from your AI CLI, your installation is complete.

## Troubleshooting

### PATAPIM won't start

- Ensure Node.js 18+ is installed: `node --version`
- **Windows:** Try running as administrator
- **macOS:** Check System Settings > Privacy & Security for blocked apps
- Check that your antivirus isn't blocking the application

### AI CLI not responding

- Verify your CLI is installed (e.g. `claude --version` or `codex --version`)
- Check that you're authenticated with the CLI
- Ensure you have an active internet connection

### Terminal not working

- **Windows:** Ensure you have a shell available (PowerShell, Git Bash, or WSL)
- **macOS:** The default shell (zsh) should work out of the box
- Check Settings to verify the correct shell path is configured

## Next Steps

Now that PATAPIM is installed, head over to the [Quick Start Guide](./quick-start) to learn how to use it.
