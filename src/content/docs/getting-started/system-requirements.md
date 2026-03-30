---
title: "System Requirements"
description: "System requirements for running PATAPIM"
order: 3
---

## Operating System

| Platform | Minimum Version |
|----------|----------------|
| Windows  | Windows 10 (64-bit) |
| macOS    | macOS 12 Monterey (Intel & Apple Silicon) |

Linux is not officially supported with pre-built installers, but you can build from source.

## Hardware

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| RAM | 2 GB | 4 GB+ |
| Disk Space | ~500 MB | 1 GB+ |
| CPU | Any 64-bit | Multi-core |

The disk space includes the bundled Parakeet V3 voice model (~300 MB). Multiple concurrent terminals use approximately 50-100 MB each.

## Software Dependencies

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18+ | Required for from-source installs and AI CLIs |
| Git | Latest | Required for from-source installs and auto-updates |

Pre-built installers (Windows .exe, macOS DMG) bundle all runtime dependencies.

## AI CLI (at least one)

PATAPIM requires at least one AI CLI installed to use AI features:

- **Claude Code**: `npm install -g @anthropic-ai/claude-code`
- **Codex**: `npm install -g @openai/codex`
- **Gemini CLI**: `npm install -g @anthropic-ai/gemini-cli`

PATAPIM can auto-install these on first use if npm is available.

## Network

- **HTTPS** — Required for AI API calls and license verification
- **WebSocket** — Used for remote access (optional, port 31415)
- **Cloudflare Tunnel** — Used for public remote access (Pro feature, optional)

## Performance Notes

- **Voice dictation**: The Parakeet V3 model runs in a separate Node.js process. First transcription may take a few seconds while the model loads.
- **Browser panels**: Each embedded browser panel uses approximately 100-200 MB of RAM. Maximum 10 concurrent MCP browsers.
- **Remote access**: The WebSocket server runs on port 31415 by default. Virtual terminals use ANSI snapshot serialization for efficient mobile rendering.
