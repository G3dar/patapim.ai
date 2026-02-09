---
title: "Remote Access"
description: "Access PATAPIM from anywhere"
order: 2
---

# Remote Access

Access your PATAPIM workspace from any device with a web browser - laptop, tablet, or phone. Work from anywhere while your desktop handles the heavy lifting.

## Connection Modes

### Local Network Mode

Access PATAPIM from any device on your local network (home/office Wi-Fi).

**How it works:**
1. PATAPIM automatically detects your LAN IP address
2. Navigate to the displayed URL on any device (e.g., `http://192.168.1.100:31415`)
3. Scan the QR code with your phone for instant connection

**Benefits:**
- No configuration required
- Fast, low-latency connection
- No external dependencies
- Available in Free tier

### Cloudflare Tunnel Mode

Access PATAPIM from anywhere in the world with a secure public URL.

**How it works:**
1. Enable Cloudflare Tunnel in settings
2. PATAPIM creates a secure tunnel to a public URL
3. Access your workspace from any device, anywhere
4. No port forwarding or firewall configuration needed

**Benefits:**
- Access from coffee shops, hotels, or remote locations
- Share access with team members
- Secure encrypted connection
- Requires PATAPIM Pro

## Quick Connect via patapim.ai/go

The fastest way to connect remotely:

1. Sign in at [patapim.ai](https://patapim.ai) with your Google account
2. Click **Go** in the dashboard
3. PATAPIM establishes a WebSocket connection instantly using a connect-token

No URL copying, no QR codes — just click and connect. The connect-token is generated per-session and validated against your PATAPIM account.

### How Connect-Token Auth Works

1. Your PATAPIM desktop app registers with patapim.ai via account heartbeat
2. When you click "Go" on the website, a connect-token is generated
3. The website connects to your desktop via WebSocket with the token
4. Your PATAPIM instance validates the token and grants access

This method bypasses PIN/PassKey authentication since you're already signed in to patapim.ai.

## Project Filtering

When accessing PATAPIM remotely, terminals are filtered by the currently selected project:

- Only terminals belonging to the active project are shown
- Switching projects in the remote UI updates the terminal list
- This keeps the remote view focused and uncluttered, especially when you have many terminals across different projects

## Mobile Experience

### Responsive UI

The web interface automatically adapts to your device:
- **Tablet**: Full desktop experience with touch controls
- **Phone**: Optimized mobile layout with collapsible panels
- **Touch-optimized**: Large tap targets, swipe gestures

### Mobile Features

- Pinch to zoom terminal text
- Swipe between terminals
- Touch-friendly file explorer
- Virtual keyboard integration
- Landscape/portrait support

## Security

### Authentication

**Free tier:**
- **PIN authentication**: 4-6 digit PIN code
- Set PIN in remote access settings
- Required for every session

**Pro tier:**
- **PassKey authentication**: Biometric login (fingerprint, Face ID)
- **Hardware keys**: YubiKey, USB security keys
- **PIN fallback**: Available if PassKey fails
- Per-device authentication

### Connection Security

- All connections use WebSocket over HTTPS
- End-to-end encryption for Cloudflare tunnels
- Session tokens expire automatically
- No data stored on remote servers

## Getting Started

### Auto-Start Server

The remote access server starts automatically when PATAPIM launches on port **31415**. No manual configuration is needed — the server is always ready for connections.

### Enable Remote Access

1. Open PATAPIM settings
2. Navigate to "Remote Access"
3. Choose connection mode:
   - **Local Network**: Toggle on (Free)
   - **Cloudflare Tunnel**: Enable and authenticate (Pro)
4. Set up authentication (PIN or PassKey)
5. Copy URL or scan QR code

### Connecting from Another Device

**Desktop/Laptop:**
1. Open any web browser
2. Navigate to the displayed URL
3. Authenticate with PIN or PassKey

**Mobile:**
1. Scan the QR code with your camera
2. Tap the notification to open
3. Authenticate and start working

## Free vs Pro

| Feature | Free | Pro |
|---------|------|-----|
| Local Network Access | ✓ | ✓ |
| Cloudflare Tunnel | ✗ | ✓ |
| Concurrent Sessions | 1 | Unlimited |
| Session Timeout | 30 minutes | None |
| Authentication | PIN only | PIN + PassKey |
| QR Code Connect | ✓ | ✓ |

## Real-Time Sync

All remote connections use WebSocket for real-time synchronization:
- Terminal output streams instantly
- File changes appear immediately
- Multiple devices stay in sync
- Low latency (sub-100ms on LAN)

## Troubleshooting

**Can't connect on local network:**
- Verify devices are on the same Wi-Fi network
- Check firewall settings (allow port 31415)
- Try the IP address directly instead of hostname

**Cloudflare tunnel not working:**
- Verify PATAPIM Pro subscription is active
- Check internet connection
- Restart PATAPIM to refresh tunnel

**Session timeout:**
- Free tier: Sessions expire after 30 minutes of inactivity
- Pro tier: Sessions remain active indefinitely
- Refresh the page to reconnect
