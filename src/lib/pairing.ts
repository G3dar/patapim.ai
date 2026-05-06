// Shared desktop-pairing logic. The desktop app initiates a pairing by setting
// a `__patapim_pair=<sessionId>` cookie; whichever sign-in path the user
// completes (Google OAuth callback, email+password login, signup) calls
// completePairingIfPresent() to mint a device token and resolve the desktop's
// poll on /api/device/poll-pairing.

interface PairingEnv {
  LICENSES: KVNamespace;
  SESSIONS: KVNamespace;
}

// Best-effort: if a __patapim_pair cookie is present, create a device token
// for this user and write the pair-poll result. Returns the cookie-clear
// header (caller appends to its response) or null if no pairing was in flight.
export async function completePairingIfPresent(
  env: PairingEnv,
  request: Request,
  user: { googleId: string; email: string },
): Promise<string | null> {
  const cookies = request.headers.get('cookie') || '';
  const match = cookies.match(/(?:^|;\s*)__patapim_pair=([^;]+)/);
  if (!match) return null;
  const pairingSessionId = match[1];

  const now = new Date().toISOString();
  const deviceToken = crypto.randomUUID();

  await env.LICENSES.put(`device:${deviceToken}`, JSON.stringify({
    googleId: user.googleId,
    email: user.email,
    deviceName: 'PATAPIM Desktop',
    machineId: 'auto-pair',
    createdAt: now,
    lastSeen: now,
    tunnelUrl: null,
    terminalCount: 0,
  }));

  const devicesRaw = await env.LICENSES.get(`devices:${user.googleId}`);
  const devices: Array<{ token: string; deviceName: string; createdAt: string }> = devicesRaw ? JSON.parse(devicesRaw) : [];
  devices.push({ token: deviceToken, deviceName: 'PATAPIM Desktop', createdAt: now });
  await env.LICENSES.put(`devices:${user.googleId}`, JSON.stringify(devices));

  const licenseRaw = await env.LICENSES.get(`license:${user.email}`);
  const license = licenseRaw ? JSON.parse(licenseRaw) : null;

  await env.SESSIONS.put(`pair-poll:${pairingSessionId}`, JSON.stringify({
    deviceToken,
    email: user.email,
    plan: license?.plan || 'free',
    licenseStatus: license?.status || null,
    licenseKey: license?.licenseKey || null,
  }), { expirationTtl: 600 });

  return '__patapim_pair=; Secure; SameSite=Lax; Path=/; Max-Age=0';
}

export function isPairingInProgress(request: Request): boolean {
  const cookies = request.headers.get('cookie') || '';
  return /(?:^|;\s*)__patapim_pair=/.test(cookies);
}
