---
title: "Auto-Updates"
description: "Keep PATAPIM up to date automatically"
order: 12
---

## Overview

PATAPIM checks for updates automatically and can update itself with one click.

## Update Check

- Checks a **GitHub Gist** every 30 minutes for version info
- Compares remote version against local version (semver)
- Downloads from **GitHub Releases** (G3dar/patapim-releases)

## Update Process

When a new version is available:
1. A notification appears in the app
2. Click to download and install
3. PATAPIM restarts with the new version

Uses **electron-updater** for staged rollout.

## Force Updates

Critical updates can trigger a **force update overlay** — a modal that can't be dismissed until the user updates. This is used only for security-critical releases.
