// Deterministic SVG-initial avatar for users without a Google profile picture.
// Returns a self-contained data: URL — no external HTTP, no privacy leak, no
// CSP headaches. The hue is constrained to the page's warm-amber palette so
// every generated avatar harmonizes with the rest of the UI.

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickInitial(email: string, name?: string): string {
  const fromName = (name || '').trim();
  const fromEmail = (email || '').trim();
  const ch = (fromName[0] || fromEmail[0] || '?').toUpperCase();
  return ch;
}

export function getAvatarDataUrl(email: string, name?: string): string {
  const initial = pickInitial(email, name);
  const seed = `${email}|${name || ''}`;
  const hash = stableHash(seed || '?');

  // Warm hue range (red-orange through gold) to match the amber accent.
  const hue = 10 + (hash % 50);          // 10°–60°
  const sat = 28 + ((hash >> 8) % 12);   // 28%–40%
  const lig = 32 + ((hash >> 16) % 8);   // 32%–40%
  const bg = `hsl(${hue} ${sat}% ${lig}%)`;
  const bgEdge = `hsl(${hue} ${sat}% ${Math.max(lig - 8, 18)}%)`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<defs><radialGradient id="g" cx="0.3" cy="0.25" r="0.95">` +
    `<stop offset="0%" stop-color="${bg}"/>` +
    `<stop offset="100%" stop-color="${bgEdge}"/>` +
    `</radialGradient></defs>` +
    `<rect width="64" height="64" rx="32" fill="url(#g)"/>` +
    `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" ` +
    `font-family="-apple-system,BlinkMacSystemFont,DM Sans,Segoe UI,Helvetica,Arial,sans-serif" ` +
    `font-size="28" font-weight="600" fill="#f4ede2">${escapeXml(initial)}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c] as string));
}

// Public helper for the renderer: returns the user's Google picture if set,
// otherwise the generated initial avatar.
export function avatarFor(picture: string | null | undefined, email: string, name?: string): string {
  if (picture && picture.trim()) return picture;
  return getAvatarDataUrl(email, name);
}
