---
title: "Remote Access"
description: "Access PATAPIM from anywhere"
order: 2
---

## Overview

Control your PATAPIM desktop from any phone, tablet, or browser via a built-in Express + WebSocket server on port 31415.

## Authentication

| Method | Expiry | Use Case |
|--------|--------|----------|
| Token | 1 year | Persistent device access |
| PIN | 5 minutes | Quick temporary access |
| PassKey/WebAuthn | Permanent | Biometric auth |

## Connection Modes

- **LAN** (Free): Access on your local network at `http://<ip>:31415`
- **Cloudflare Tunnel** (Pro): Public URL via Cloudflare — no port forwarding needed

## Virtual Terminal

Uses ANSI snapshot serialization instead of raw PTY output for clean mobile rendering. Snapshots at ~80ms intervals, only sending changed terminals.

## Terminal State

Remote clients receive terminal state indicators: `isProcessing`, `isPlanMode`, `needsAttention`.

## Configuration

Override the port with `PATAPIM_PORT` environment variable. Token stored at `~/.patapim/mcp-token`.
