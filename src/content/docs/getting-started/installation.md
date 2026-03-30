---
title: "Installation"
description: "How to install PATAPIM on your system"
order: 1
---

## One-Line Install

The fastest way to install PATAPIM. Open a terminal and run one command:

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/G3dar/patapim-releases/main/install.ps1 | iex
```

### Windows (CMD)

```cmd
curl -fsSL https://raw.githubusercontent.com/G3dar/patapim-releases/main/install.cmd -o "%TEMP%\patapim-install.cmd" && "%TEMP%\patapim-install.cmd"
```

### macOS (Terminal)

```bash
curl -fsSL https://raw.githubusercontent.com/G3dar/patapim-releases/main/install-mac.sh | bash
```

## Download Installer

Download directly from [patapim.ai/download](https://patapim.ai/download):

- **Windows**: NSIS installer (.exe) — Windows 10 or later
- **macOS**: DMG — macOS 12+ (separate builds for Apple Silicon and Intel)

On macOS, you may need to right-click and select "Open" the first time to bypass Gatekeeper.

## Install from Source

For development or if you prefer building from source:

```bash
git clone https://github.com/G3dar/patapim.git
cd patapim
npm install
npm start
```

Requires Node.js 18+ and Git. On macOS, you may also need Xcode command line tools (`xcode-select --install`).

## Verify Installation

After installation, launch PATAPIM. You should see the 3-panel interface with a sidebar on the left, terminal area in the center, and a toggleable panel on the right.

## Prerequisites

Before using PATAPIM's AI features, install at least one AI CLI:

- **Claude Code**: `npm install -g @anthropic-ai/claude-code`
- **Codex**: `npm install -g @openai/codex`
- **Gemini CLI**: `npm install -g @anthropic-ai/gemini-cli`

PATAPIM auto-detects installed AI CLIs and can install them for you on first use.
