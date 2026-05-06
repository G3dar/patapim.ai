// Password policy: ≥10 chars + HIBP k-anonymity check (only the first 5 hex
// chars of the SHA-1 leave the worker; the full hash never leaves).
// Returns an array of human-readable errors; empty = OK.

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 256;

export async function validatePassword(password: string): Promise<string[]> {
  const errors: string[] = [];

  if (typeof password !== 'string') {
    return ['Password is required.'];
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password must be at most ${MAX_PASSWORD_LENGTH} characters.`);
  }
  if (!password.trim()) {
    errors.push('Password cannot be empty or only whitespace.');
  }

  if (errors.length === 0) {
    try {
      const breached = await isPasswordBreached(password);
      if (breached) {
        errors.push('This password appears in known data breaches. Please choose a different one.');
      }
    } catch {
      // HIBP is best-effort. If their API is down, don't block signup.
    }
  }

  return errors;
}

async function sha1Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function isPasswordBreached(password: string): Promise<boolean> {
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' },
  });
  if (!res.ok) throw new Error(`HIBP ${res.status}`);
  const text = await res.text();

  for (const line of text.split('\n')) {
    const [hashSuffix, countStr] = line.trim().split(':');
    if (!hashSuffix) continue;
    if (hashSuffix.toUpperCase() === suffix) {
      const count = parseInt(countStr, 10);
      // Padded entries have count 0; treat any non-zero hit as breached.
      return Number.isFinite(count) && count > 0;
    }
  }
  return false;
}
