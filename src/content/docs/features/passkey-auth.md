---
title: "PassKey Authentication"
description: "Biometric authentication for remote sessions"
order: 11
---

## Overview

PATAPIM supports WebAuthn/PassKey authentication for remote access sessions using **@simplewebauthn/server v13+**.

## How It Works

1. Register a PassKey (Touch ID, Windows Hello, hardware key) via the remote access UI
2. Credentials stored at `~/.patapim/passkeys.json`
3. Add the PassKey to the trusted list at `~/.patapim/trusted-passkeys.json`
4. Authenticate remote sessions with biometrics

## Security

- Challenge expiry: **5 minutes**
- Only trusted PassKeys can authenticate (whitelist-based)
- JWT tokens are validated against the PassKey trust status

## Supported Methods

- Touch ID (macOS)
- Windows Hello (Windows)
- Hardware security keys (YubiKey, etc.)
