---
title: "PassKey Authentication"
description: "Biometric authentication for remote sessions"
order: 11
---

# PassKey Authentication

PATAPIM supports WebAuthn/PassKey authentication for secure biometric login when accessing remote sessions. Use Touch ID, Windows Hello, or hardware security keys to authenticate without passwords.

## What are PassKeys?

**PassKeys** are a modern authentication method based on the WebAuthn standard. They provide:

- **Passwordless authentication**: No need to remember or type passwords
- **Biometric security**: Use fingerprint, face recognition, or hardware keys
- **Phishing resistance**: Keys are bound to specific domains
- **Device-based**: Keys are stored securely on your device

PassKeys are the successor to passwords, offering better security and user experience.

## Supported Authentication Methods

PATAPIM supports multiple PassKey authentication methods:

### Touch ID (macOS)

Use your fingerprint to authenticate:
- Available on MacBooks with Touch ID
- Fast and convenient
- Secure Enclave storage

### Windows Hello (Windows)

Use Windows biometric authentication:
- Fingerprint readers
- Facial recognition (IR cameras)
- PIN as fallback

### Hardware Security Keys

Use physical security keys:
- YubiKey
- Titan Security Key
- Any FIDO2-compliant device

## How PassKey Auth Works with Remote Access

PassKeys are used when accessing PATAPIM remotely through the tunnel system:

1. **Authenticate on deployer domain**: You visit the PATAPIM web interface at `https://deployer.patapim.ai`
2. **PassKey prompt**: Browser prompts for biometric authentication
3. **JWT issuance**: After successful auth, a JWT (JSON Web Token) is issued
4. **Tunnel redirect**: You're redirected to your personal tunnel subdomain with the JWT
5. **Authenticated session**: The tunnel validates the JWT and grants access

This flow ensures secure remote access without transmitting passwords over the network.

### Example Flow

```
User visits: https://deployer.patapim.ai/auth
  ↓
Browser prompts: "Touch ID to sign in to patapim.ai"
  ↓
User authenticates with fingerprint
  ↓
Server issues JWT token
  ↓
Redirect to: https://user-abc123.tunnel.patapim.ai?token=<jwt>
  ↓
Tunnel validates JWT and establishes session
```

## Registering PassKeys

Before you can use PassKey authentication, you need to register your PassKey with PATAPIM.

### First-Time Registration

1. Open PATAPIM settings
2. Navigate to **Security > PassKey Authentication**
3. Click "Register PassKey"
4. Choose a display name for this PassKey (e.g., "MacBook Pro Touch ID")
5. Follow the browser prompt to authenticate
6. Your PassKey is now registered

### Registering Multiple PassKeys

You can register multiple PassKeys for different devices:

- **MacBook**: Touch ID
- **Windows PC**: Windows Hello
- **Mobile device**: Biometric or hardware key

Each PassKey can have a unique display name to identify it.

## Managing PassKeys

View and manage your registered PassKeys in the settings panel.

### Viewing PassKeys

The PassKey management panel shows:
- PassKey display name
- Date registered
- Last used (if applicable)
- Device type (detected from user agent)

### Revoking PassKeys

To remove a PassKey:

1. Open PATAPIM settings
2. Navigate to **Security > PassKey Authentication**
3. Find the PassKey you want to remove
4. Click "Revoke" next to the PassKey
5. Confirm the revocation

Revoked PassKeys can no longer be used for authentication. You can re-register the same device later if needed.

## Trusted PassKey Management

Manage trusted PassKeys for remote access from the PATAPIM desktop app.

### Approving New Devices

When a new device attempts to connect via PassKey:

1. A **pending approval notification** appears in the PATAPIM desktop app
2. Review the device name and PassKey fingerprint
3. Click **Approve** to trust the device or **Deny** to reject it
4. Approved devices are saved to `~/.patapim/trusted-passkeys.json`

### Managing Trusted Devices

View and manage trusted devices:
- Open **Settings > Security > Trusted Devices**
- See all approved PassKeys with device names and last-used dates
- Click **Remove** to revoke trust from a specific device

## Security Considerations

### Biometric Data

PATAPIM never receives your biometric data (fingerprint, face scan). Biometric authentication happens entirely on your device:

1. Browser prompts for biometric auth
2. Device validates biometric locally
3. Device generates a cryptographic signature
4. Only the signature is sent to PATAPIM

Your fingerprint or face data never leaves your device.

### PassKey Storage

PassKeys are stored differently depending on the method:

- **Touch ID**: Secure Enclave on macOS
- **Windows Hello**: TPM (Trusted Platform Module)
- **Hardware keys**: On the physical key device

PATAPIM stores only the public key associated with each PassKey. The private key remains on your device.

### JWT Tokens

JWT tokens issued after authentication:

- Expire after 24 hours
- Are signed with a secret key
- Contain minimal claims (user ID, expiration)
- Cannot be reused across different tunnel sessions

## Fallback Authentication

If PassKey authentication fails or is unavailable:

1. **Backup codes**: Generate one-time backup codes in settings
2. **Email verification**: Receive a magic link via email
3. **Traditional password**: Optionally set a password as fallback

Configure fallback methods in **Security > Authentication Fallbacks**.

## Browser Compatibility

PassKey authentication requires a modern browser with WebAuthn support:

- ✅ Chrome/Edge 90+
- ✅ Firefox 90+
- ✅ Safari 14+
- ✅ Brave 1.30+

On unsupported browsers, PATAPIM automatically falls back to alternative authentication methods.
