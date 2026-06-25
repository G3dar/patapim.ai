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

// Standalone, fully-designed purchase email (does NOT use the minimal `shell`):
// PATAPIM brand palette taken from the real "P" app logo — space-navy #07061a
// with cyan #49F0F8 + magenta #D855E9 accents — the logo image in the header,
// a highlighted license-key block, a gradient CTA, and a numbered getting-
// started section. All styles are inlined for email-client safety.
// The logo (the cosmic pixel "P") is hosted at /email-logo.png — data-URI/SVG
// marks get stripped by Gmail-based clients, so it must be a real hosted PNG.
// NOTE: versioned filename — Gmail/clients cache the proxied image by URL, so a
// changed logo at the same path keeps showing the stale copy. Bump the version
// (-v2, -v3…) whenever the logo art changes.
const LOGO_URL = 'https://patapim.ai/email-logo-v2.png';

export function purchaseWelcome(
  name: string,
  plan: 'pro' | 'lifetime',
  licenseKey: string,
  dashboardUrl: string,
  downloadUrl: string,
): TemplateOut {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const planLabel = plan === 'lifetime' ? 'Lifetime' : 'Pro';
  // Sober, premium transactional look — DARK mode. Monochrome on near-black,
  // the logo provides the color. Brand palette (cyan #49F0F8 + magenta #D855E9)
  // shows only as a thin top hairline; the light CTA is the single emphasis.
  const bg = '#0b0a12';
  const card = '#14131c';
  const cardBorder = '#262531';
  const borderSoft = '#232230';
  const panel = '#1b1a24';
  const panelBorder = '#2c2b37';
  const textLight = '#f1f2f5';
  const muted = '#9a9ca8';
  const faint = '#6c6e7b';
  const stepBg = '#23222e';
  const stepBorder = '#34333f';
  const stepText = '#cfd0d8';
  const teal = '#6ad7dd'; // soft cyan — readable link accent on dark
  const font = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
  const mono = `ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;

  const step = (n: number, text: string) => `
    <tr>
      <td valign="top" style="padding:0 12px 14px 0;width:24px;">
        <div style="width:24px;height:24px;border-radius:50%;background:${stepBg};border:1px solid ${stepBorder};color:${stepText};font-family:${font};font-size:12px;font-weight:700;text-align:center;line-height:24px;">${n}</div>
      </td>
      <td valign="top" style="padding:0 0 14px 0;font-family:${font};font-size:14px;line-height:1.5;color:${muted};">${text}</td>
    </tr>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${bg};">
  <div style="background:${bg};padding:32px 16px;font-family:${font};">
    <div style="max-width:560px;margin:0 auto;background:${card};border:1px solid ${cardBorder};border-radius:14px;overflow:hidden;">

      <!-- thin brand accent -->
      <div style="height:3px;background:linear-gradient(90deg,#49F0F8,#D855E9);font-size:0;line-height:0;">&nbsp;</div>

      <!-- Header -->
      <div style="padding:30px 32px 24px;text-align:center;border-bottom:1px solid ${borderSoft};">
        <img src="${LOGO_URL}" width="52" height="55" alt="PATAPIM" style="display:inline-block;vertical-align:middle;width:52px;height:55px;border-radius:12px;" />
        <span style="display:inline-block;vertical-align:middle;margin-left:12px;font-family:${font};font-size:20px;font-weight:700;letter-spacing:1.5px;color:${textLight};">PATAPIM</span>
      </div>

      <!-- Body -->
      <div style="padding:34px 32px 30px;">
        <h1 style="margin:0 0 16px;font-family:${font};font-size:22px;font-weight:700;color:${textLight};">Welcome to PATAPIM ${planLabel}</h1>
        <p style="margin:0 0 14px;font-family:${font};font-size:15px;line-height:1.6;color:${muted};">${greeting}</p>
        <p style="margin:0 0 8px;font-family:${font};font-size:15px;line-height:1.6;color:${muted};">Thanks for your purchase. Your <strong style="color:${textLight};">${planLabel}</strong> plan is active — here's your license key.</p>

        <!-- License key block -->
        <div style="background:${panel};border:1px solid ${panelBorder};border-radius:10px;padding:20px;margin:22px 0;text-align:center;">
          <div style="font-family:${font};font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${faint};margin-bottom:10px;">License key</div>
          <div style="font-family:${mono};font-size:23px;font-weight:700;letter-spacing:2px;color:${textLight};">${licenseKey}</div>
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin:24px 0 8px;">
          <a href="${downloadUrl}" style="display:inline-block;background:${textLight};color:${card};text-decoration:none;padding:13px 32px;border-radius:9px;font-family:${font};font-size:15px;font-weight:600;">Download PATAPIM</a>
        </div>

        <!-- Getting started -->
        <div style="margin-top:28px;padding-top:24px;border-top:1px solid ${borderSoft};">
          <div style="font-family:${font};font-size:12px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:${faint};margin-bottom:16px;">Getting started</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
            ${step(1, 'Download &amp; open PATAPIM (or launch it if already installed).')}
            ${step(2, `Go to <strong style="color:${textLight};">Account</strong> and paste the license key above.`)}
            ${step(3, 'You&#39;re in — start building with your AI coding terminals.')}
          </table>
        </div>
      </div>

      <!-- Footer -->
      <div style="background:#0d0c15;padding:22px 32px;text-align:center;border-top:1px solid ${borderSoft};">
        <p style="margin:0 0 6px;font-family:${font};font-size:13px;line-height:1.5;color:${faint};">Lost your key? Find it anytime at <a href="${dashboardUrl}" style="color:${teal};text-decoration:none;font-weight:600;">patapim.ai/go</a> — we don&#39;t store it anywhere else, so keep this email handy.</p>
        <p style="margin:0;font-family:${font};font-size:13px;line-height:1.5;color:${faint};">Need a hand? Just reply to this email and we&#39;ll help you out.</p>
      </div>

    </div>
  </div>
</body></html>`;

  const text = `${greeting}\n\nThanks for your purchase — your ${planLabel} plan is active.\n\nYOUR LICENSE KEY\n${licenseKey}\n\nGetting started:\n1. Download & open PATAPIM — ${downloadUrl}\n2. Go to Account and paste the key above.\n3. You're in — start building.\n\nLost your key? Find it anytime at ${dashboardUrl} after signing in.\nNeed a hand? Just reply to this email.`;
  return { subject: `Your PATAPIM ${planLabel} license key`, html, text };
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
