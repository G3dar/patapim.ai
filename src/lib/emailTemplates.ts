// Plain HTML transactional templates. Single CTA, plaintext fallback.

interface TemplateOut {
  subject: string;
  html: string;
  text: string;
}

const baseStyle = `
  body { background:#f6f7f9; margin:0; padding:32px 16px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; color:#1d1d1f; }
  .card { max-width:520px; margin:0 auto; background:#ffffff; border-radius:14px; padding:36px 28px; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
  h1 { font-size:20px; margin:0 0 16px; }
  p { font-size:15px; line-height:1.5; margin:0 0 14px; }
  .btn { display:inline-block; background:#000; color:#fff !important; text-decoration:none; padding:12px 22px; border-radius:10px; font-size:15px; font-weight:600; margin:8px 0 18px; }
  .muted { color:#7d7d80; font-size:13px; }
  .raw { word-break:break-all; color:#7d7d80; font-size:13px; }
  .logo { font-weight:700; letter-spacing:0.5px; margin-bottom:18px; }
`;

function shell(inner: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseStyle}</style></head><body><div class="card"><div class="logo">PATAPIM</div>${inner}</div></body></html>`;
}

export function welcomeAndVerify(name: string, verifyUrl: string): TemplateOut {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const html = shell(`
    <h1>Welcome to PATAPIM</h1>
    <p>${greeting}</p>
    <p>Thanks for signing up. Verify your email so you can recover your account if you ever forget your password.</p>
    <p><a class="btn" href="${verifyUrl}">Verify my email</a></p>
    <p class="muted">Or paste this link into your browser:</p>
    <p class="raw">${verifyUrl}</p>
    <p class="muted">If you didn't create a PATAPIM account, you can ignore this email.</p>
  `);
  const text = `${greeting}\n\nWelcome to PATAPIM. Verify your email so you can recover your account if you ever forget your password.\n\nVerify: ${verifyUrl}\n\nIf you didn't sign up, ignore this email.`;
  return { subject: 'Welcome to PATAPIM — verify your email', html, text };
}

export function passwordReset(name: string, resetUrl: string): TemplateOut {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const html = shell(`
    <h1>Reset your password</h1>
    <p>${greeting}</p>
    <p>We received a request to reset your PATAPIM password. Click the button below to choose a new one. The link is valid for 1 hour.</p>
    <p><a class="btn" href="${resetUrl}">Reset password</a></p>
    <p class="muted">Or paste this link into your browser:</p>
    <p class="raw">${resetUrl}</p>
    <p class="muted">If you didn't request a reset, you can safely ignore this email — your password won't change.</p>
  `);
  const text = `${greeting}\n\nReset your PATAPIM password (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore the email.`;
  return { subject: 'Reset your PATAPIM password', html, text };
}

export function emailVerify(name: string, verifyUrl: string): TemplateOut {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const html = shell(`
    <h1>Verify your email</h1>
    <p>${greeting}</p>
    <p>Click the button below to verify your email address. The link is valid for 24 hours.</p>
    <p><a class="btn" href="${verifyUrl}">Verify my email</a></p>
    <p class="muted">Or paste this link into your browser:</p>
    <p class="raw">${verifyUrl}</p>
  `);
  const text = `${greeting}\n\nVerify your email (valid for 24 hours):\n${verifyUrl}`;
  return { subject: 'Verify your PATAPIM email', html, text };
}
