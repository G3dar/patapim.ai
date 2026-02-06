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
2. Navigate to the displayed URL on any device (e.g., `http://192.168.1.100:3000`)
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
- Check firewall settings (allow port 3000)
- Try the IP address directly instead of hostname

**Cloudflare tunnel not working:**
- Verify PATAPIM Pro subscription is active
- Check internet connection
- Restart PATAPIM to refresh tunnel

**Session timeout:**
- Free tier: Sessions expire after 30 minutes of inactivity
- Pro tier: Sessions remain active indefinitely
- Refresh the page to reconnect
