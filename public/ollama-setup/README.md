# PATAPIM — Ollama Server Setup

This folder holds the one-shot installers for the Ollama server that PATAPIM uses for local LLM inference (context summaries, title generation, etc.).

## Quick install

### Windows

Open an **elevated PowerShell** and run:

```powershell
iwr -useb https://patapim.ai/ollama-setup/install-windows.ps1 | iex
```

### macOS / Linux

```bash
curl -fsSL https://patapim.ai/ollama-setup/install-unix.sh | bash
```

## What the installer does

1. Installs Ollama if not already present.
2. Optionally binds it to `0.0.0.0:11434` so other devices on your LAN can reach it (Windows only — Unix prints manual steps since the service is system-owned).
3. Opens the Windows Firewall on port 11434 (private profile, restricted to the Ollama binary).
4. Pulls the default model (`qwen2.5:7b`).
5. Prints the local + LAN URLs so you can paste them into the admin panel.

## After install

1. Go to https://patapim.ai/admin → **Ollama Server** tab.
2. Fill in the host/port/protocol. Toggle **Enabled**. Save.
3. Every PATAPIM device linked to your Google account will read this config and use it automatically.

## Config schema (stored in Cloudflare KV under `ollamaConfig:{googleId}`)

```jsonc
{
  "version": 1,
  "host": "192.168.1.7",      // or "localhost"
  "port": 11434,
  "protocol": "http",          // or "https"
  "publicUrl": "https://ollama.patapim.ai",  // optional remote fallback
  "defaultModel": "qwen2.5:7b",
  "enabled": true,
  "updatedAt": "2026-04-18T...Z",
  "createdAt": "2026-04-18T...Z",
  "updatedFromInstance": null
}
```

## Endpoints

- `GET /api/admin/ollama-config` — admin pulls config (session auth).
- `POST /api/admin/ollama-config` — admin saves config.
- `GET /api/device/ollama-config` — desktop app / tray monitor pulls config by device token (`Authorization: Bearer <deviceToken>`).

## Tray monitor (Windows)

A small Electron tray app that watches the configured Ollama server and shows status + recent requests lives at `C:\Users\ghell\ollama-monitor\` (local to this workstation). It is not part of this installer — it is a separate development utility.
