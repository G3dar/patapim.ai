---
title: "System Requirements"
description: "System requirements for running PATAPIM"
order: 3
---

# System Requirements

PATAPIM is designed to run efficiently on modern systems. Review the requirements below to ensure optimal performance.

## Operating System

### Windows

- **Minimum**: Windows 10 (64-bit)
- **Recommended**: Windows 11 (64-bit)
- **Shell**: PowerShell 5.1+, Git Bash, or WSL2

### macOS

- **Minimum**: macOS 10.13 (High Sierra)
- **Recommended**: macOS 12 (Monterey) or later
- **Architecture**: Intel or Apple Silicon (M1/M2/M3)

### Linux

- **Distribution**: Ubuntu 18.04+, Fedora 32+, Debian 10+, or equivalent
- **Architecture**: x64 or ARM64
- **Note**: Build from source; no pre-built installer available
- **Desktop Environment**: X11 or Wayland

## Software Requirements

### Required

- **Node.js**: Version 18.0.0 or higher
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify: `node --version`

- **npm**: Version 8.0.0 or higher (comes with Node.js)
  - Verify: `npm --version`

- **Git**: Version 2.0.0 or higher
  - Download from [git-scm.com](https://git-scm.com/)
  - Verify: `git --version`

- **Claude Code CLI**: Latest version
  - Install: `npm install -g @anthropic-ai/claude-code`
  - Must be authenticated with valid Anthropic API key
  - Verify: `claude --version`

### Optional but Recommended

- **Visual Studio Code** or other code editor for editing files
- **Docker** (if working with containers)
- **Python 3.8+** (if using Python-based Claude Code features)
- **Cloudflare Tunnel (cloudflared)** — Required for remote access via public URL. [Install cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
- **HuggingFace Transformers.js** — Downloaded automatically for Local Whisper offline dictation (no manual install needed)

## Hardware Requirements

### Minimum Specifications

- **CPU**: Dual-core processor, 2.0 GHz or faster
- **RAM**: 4 GB
- **Disk Space**: 200 MB for PATAPIM + additional space for projects
- **Display**: 1280x720 resolution

### Recommended Specifications

- **CPU**: Quad-core processor, 3.0 GHz or faster
- **RAM**: 8 GB or more
- **Disk Space**: 1 GB free space (for comfortable operation)
- **Display**: 1920x1080 or higher resolution
- **Internet**: Broadband connection for Claude Code API calls

### Performance Notes

- **Multiple terminals**: Each terminal uses ~50-100 MB of RAM
- **Grid layout**: 9 terminals at once requires 4-8 GB RAM total
- **Voice dictation**: Adds ~200 MB RAM for Whisper model
- **Remote access**: Minimal overhead, ~10-20 MB RAM for WebSocket server

## Network Requirements

### Claude Code API

- **Connection**: HTTPS access to Anthropic API endpoints
- **Ports**: Outbound 443 (HTTPS)
- **Bandwidth**: ~1-5 Mbps recommended for responsive Claude Code interactions
- **Latency**: Lower is better; <100ms ideal

### Remote Access (Optional)

- **WebSocket**: Port 8080 (configurable)
- **Cloudflare Tunnel**: Requires Cloudflare account
- **Bandwidth**: ~2-10 Mbps depending on terminal usage

## Browser Requirements (for Remote Access)

When accessing PATAPIM remotely via web browser:

- **Chrome/Edge**: Version 90+
- **Firefox**: Version 88+
- **Safari**: Version 14+
- **Mobile**: iOS 14+ or Android 10+

Modern browsers with WebSocket and Web Speech API support.

## Additional Platform-Specific Requirements

### Windows

- **Terminal**: PowerShell 5.1+ (comes with Windows 10/11) or Git Bash
- **Build Tools**: Visual C++ Redistributable (for native modules)
- **WSL2**: Optional but recommended for Linux tooling

### macOS

- **Xcode Command Line Tools**: Required for building from source
  - Install: `xcode-select --install`
- **Rosetta 2**: Automatically installed on Apple Silicon if needed

### Linux

- **Build Essentials**: `build-essential`, `libssl-dev`
  - Ubuntu/Debian: `sudo apt install build-essential libssl-dev`
  - Fedora: `sudo dnf install @development-tools openssl-devel`
- **X11 or Wayland**: Required for Electron GUI

## Verifying Your System

Run this command to check your system meets the requirements:

```bash
node --version && npm --version && git --version && claude --version
```

Expected output:

```
v18.x.x
8.x.x
git version 2.x.x
claude version x.x.x
```

If all commands return version numbers, your system is ready for PATAPIM.

## Troubleshooting

### Node.js version too old

Update Node.js to version 18+:

```bash
# Using nvm (recommended)
nvm install 18
nvm use 18

# Or download from nodejs.org
```

### Claude Code CLI not found

Install globally:

```bash
npm install -g @anthropic-ai/claude-code
claude auth
```

### Performance issues

If PATAPIM runs slowly:

- Close unused terminals to free RAM
- Reduce grid layout (use 1x1 or 2x2 instead of 3x3)
- Disable voice dictation if not needed
- Check system resources (CPU/RAM usage)
- Ensure no other heavy applications are running

### Out of memory

If you get "out of memory" errors:

- Close some terminals
- Restart PATAPIM
- Increase Node.js memory limit: `NODE_OPTIONS=--max-old-space-size=4096 npm start`

## Performance Optimization Tips

- Use fewer terminals if RAM is limited
- Enable hardware acceleration in Electron settings
- Keep Node.js and npm updated
- Close projects you're not actively working on
- Use remote access from low-end devices (offloads processing to host machine)

## Next Steps

Now that you've verified your system meets the requirements:

- Proceed to [Installation](./installation) to set up PATAPIM
- Or jump to [Quick Start](./quick-start) if already installed
