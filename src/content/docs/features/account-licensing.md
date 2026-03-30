---
title: "Account & Licensing"
description: "Sign in, manage plans, and license your PATAPIM installation"
order: 13
---

## Overview

PATAPIM uses Google OAuth for authentication and a tiered licensing system.

## Sign In

Device-code OAuth flow via Google. Your account data is stored at `~/.patapim/account.json`.

## License Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 9 terminals, 3 projects, 30 min dictation, LAN remote |
| **Pro** | $6.99/month | Unlimited terminals, projects, dictation, Cloudflare tunnel |
| **Lifetime** | $29.99 one-time | All Pro features permanently |

## License Verification

PATAPIM verifies your license every 30 minutes while running. Only your email and license key are sent to the server.

## Upgrade Polling

After purchase, the app polls for license updates so the upgrade takes effect without restarting.

## Referral Integration

Pending referral credits are auto-claimed on login. See the [Referral Program](/docs/features/referral-program) for details.
