---
title: "Account & Licensing"
description: "Sign in, manage plans, and license your PATAPIM installation"
order: 13
---

# Account & Licensing

Sign in to PATAPIM to unlock plan features, sync your license across devices, and manage your subscription.

## Sign-In Flow

PATAPIM uses device-code authentication through patapim.ai. No passwords to remember — you sign in with your Google account.

**How it works:**

1. Click "Sign In" in the sidebar or go to **View > Sign In**
2. PATAPIM opens your default browser to `patapim.ai/login`
3. A pairing code is displayed in PATAPIM
4. Sign in with Google in the browser
5. Enter the pairing code to link your device
6. PATAPIM detects the successful sign-in automatically

Your account information is cached locally at:

```
~/.patapim/account.json
```

On Windows:

```
C:\Users\<username>\.patapim\account.json
```

## Plans

PATAPIM offers three plans:

| Feature | Free | Pro | Lifetime |
|---------|------|-----|----------|
| **Price** | $0 | $6.99/mo | $29.99 one-time |
| Terminals | 9 | 50 | 50 |
| Projects | 3 | Unlimited | Unlimited |
| Voice Dictation | 30 minutes | Unlimited | Unlimited |
| Local Remote Access | Yes | Yes | Yes |
| Cloudflare Tunnel | No | Yes | Yes |
| PassKey Auth | No | Yes | Yes |

**Free** is great for trying PATAPIM and working on small projects. **Pro** removes all limits and adds advanced features. **Lifetime** gives you the same Pro features with a single one-time payment.

## Upgrading

1. Click **"Upgrade"** in the sidebar, or go to **View > Upgrade**
2. The upgrade modal shows a side-by-side plan comparison
3. Select **Pro** or **Lifetime**
4. Stripe checkout opens in your browser
5. Complete payment
6. PATAPIM detects the plan change automatically — no restart needed

## License Verification

Your license is verified and cached locally in `~/.patapim/account.json`. This means:

- **Initial verification** happens at sign-in via patapim.ai
- **Periodic refresh** occurs every 30 minutes via a background heartbeat
- **Offline support** — after the initial verification, PATAPIM works offline using the cached license data
- **No always-on connection** required to use Pro features

If your subscription expires or is cancelled, the license will update on the next heartbeat check and features will revert to the Free tier.

## Account Heartbeat

PATAPIM sends a lightweight heartbeat to patapim.ai every 2 minutes while running. The heartbeat reports:

- **Active terminal count** — how many terminals are currently open
- **Tunnel status** — whether a Cloudflare tunnel is active

This data is used to enforce plan limits and keep your license status current. No terminal content, file data, or personal information is transmitted.

## Sign Out

To sign out of PATAPIM:

1. Go to **View > Sign Out**
2. Confirm the sign-out prompt

This clears all local account data from `~/.patapim/account.json`. After signing out, PATAPIM reverts to Free tier limits until you sign in again.

## Troubleshooting

**Browser doesn't open during sign-in:**
- Try navigating to `patapim.ai/login` manually
- Enter the pairing code shown in PATAPIM

**Plan not updating after payment:**
- Wait a few moments for the heartbeat to refresh
- Try signing out and signing back in
- Check that payment was completed in Stripe

**License shows as Free after restarting:**
- Verify you're signed in (check the sidebar)
- Ensure you have an internet connection for the initial heartbeat
- Sign out and sign back in to force a refresh
