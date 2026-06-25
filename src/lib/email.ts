import { welcomeAndVerify, passwordReset, emailVerify, purchaseWelcome } from './emailTemplates';

// From address must use the apex domain (patapim.ai), which is what Resend
// verified with the DKIM record at resend._domainkey.patapim.ai. The `send.`
// subdomain is only the bounce envelope (MAIL FROM); it is not a valid From
// header until/unless we add it as a separate verified domain in Resend.
const FROM = 'PATAPIM <noreply@patapim.ai>';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

interface SendInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface ResendEnv {
  RESEND_API_KEY?: string;
  ADMIN_EMAIL?: string;
}

// Where bug-report / feedback notifications are delivered.
const DEFAULT_ADMIN_EMAIL = 'g@3dar.com';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function send(env: ResendEnv, input: SendInput): Promise<void> {
  if (!env.RESEND_API_KEY) {
    // Local dev / misconfigured: log and skip silently. Never throw — email
    // failures must not fail the user-facing API call.
    console.warn('RESEND_API_KEY not set; skipping email to', input.to);
    return;
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('Resend send failed', res.status, body);
  }
}

export async function sendWelcomeAndVerify(env: ResendEnv, to: string, name: string, verifyUrl: string): Promise<void> {
  const t = welcomeAndVerify(name, verifyUrl);
  await send(env, { to, ...t });
}

// Sent after a successful Stripe purchase. Delivers the license key (the system
// does NOT store it anywhere the user can self-serve except the signed-in
// dashboard, so this email is the customer's primary copy). Reply-to points at
// support so customers can reply for help instead of hitting the noreply void.
export async function sendPurchaseWelcome(
  env: ResendEnv,
  to: string,
  name: string,
  plan: 'pro' | 'lifetime',
  licenseKey: string,
): Promise<void> {
  const t = purchaseWelcome(name, plan, licenseKey, 'https://patapim.ai/go', 'https://patapim.ai/download');
  await sendEmail(env, { to, ...t, replyTo: env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL });
}

export async function sendPasswordReset(env: ResendEnv, to: string, name: string, resetUrl: string): Promise<void> {
  const t = passwordReset(name, resetUrl);
  await send(env, { to, ...t });
}

export async function sendEmailVerify(env: ResendEnv, to: string, name: string, verifyUrl: string): Promise<void> {
  const t = emailVerify(name, verifyUrl);
  await send(env, { to, ...t });
}

// Generic transactional sender with optional reply-to + attachments. Used by
// endpoints (e.g. bug reports) that build their own subject/body and need the
// reporter set as reply-to and screenshots attached. Mirrors the private
// send() but exposes the extra Resend fields (`reply_to`, `attachments`).
interface EmailAttachment {
  filename: string;
  content: string; // base64-encoded file content
}

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail(env: ResendEnv, input: SendEmailInput): Promise<void> {
  if (!env.RESEND_API_KEY) {
    // Local dev / misconfigured: log and skip. Never throw — email failures
    // must not fail the user-facing API call.
    console.warn('RESEND_API_KEY not set; skipping email to', input.to);
    return;
  }

  const payload: Record<string, unknown> = {
    from: FROM,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text,
  };
  if (input.replyTo) payload.reply_to = input.replyTo;
  if (input.attachments && input.attachments.length) {
    payload.attachments = input.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
    }));
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('Resend send failed', res.status, body);
  }
}

// Notify a team owner that someone requested a subdomain, with a one-click
// link to review/approve it. Sent off the response path by the
// subdomain-request endpoint.
export async function sendSubdomainApproval(
  env: ResendEnv,
  to: string,
  subdomain: string,
  requesterName: string,
  approveUrl: string,
): Promise<void> {
  const safeSub = escapeHtml(subdomain);
  const safeName = escapeHtml(requesterName || 'Someone');
  const safeUrl = escapeHtml(approveUrl);
  const subject = `Approve subdomain request: ${subdomain}`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;max-width:560px;color:#1a1a1a">
    <h2 style="color:#c2410c;margin:0 0 12px">Subdomain request</h2>
    <p><strong>${safeName}</strong> requested the subdomain <strong>${safeSub}</strong>.</p>
    <p style="margin:18px 0"><a href="${safeUrl}" style="display:inline-block;background:#c2410c;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">Review &amp; approve</a></p>
    <p style="color:#888;font-size:12px">Or paste this link into your browser:<br>${safeUrl}</p>
  </div>`;
  const text = `${requesterName || 'Someone'} requested the subdomain "${subdomain}".\n\nReview & approve: ${approveUrl}`;
  await send(env, { to, subject, html, text });
}

// ── Admin notifications ───────────────────────────────────────────────
// Fired when a user submits a bug report or trial feedback so the actual
// content lands in the inbox instead of only in the admin KV.

interface NotifyField {
  label: string;
  value: string;
}

async function sendAdminNotify(env: ResendEnv, subject: string, fields: NotifyField[]): Promise<void> {
  const to = env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const rows = fields
    .filter((f) => f.value && f.value.trim())
    .map(
      (f) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#888;vertical-align:top;white-space:nowrap">${escapeHtml(f.label)}</td><td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(f.value)}</td></tr>`,
    )
    .join('');
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5"><table style="border-collapse:collapse">${rows}</table></div>`;
  const text = fields
    .filter((f) => f.value && f.value.trim())
    .map((f) => `${f.label}: ${f.value}`)
    .join('\n');
  await send(env, { to, subject, html, text });
}

export async function sendBugReportNotification(
  env: ResendEnv,
  data: { email: string; description: string; appVersion: string; platform: string },
): Promise<void> {
  await sendAdminNotify(env, `🐛 Bug report${data.email ? ` from ${data.email}` : ''}`, [
    { label: 'From', value: data.email || '(no email)' },
    { label: 'Platform', value: data.platform },
    { label: 'Version', value: data.appVersion },
    { label: 'Description', value: data.description },
  ]);
}

export async function sendFeedbackNotification(
  env: ResendEnv,
  data: { email: string; improvements?: string; missingFeatures?: string; recommendScore?: number | null; featuresUsed?: string[] },
): Promise<void> {
  await sendAdminNotify(env, `💬 Feedback${data.email ? ` from ${data.email}` : ''}`, [
    { label: 'From', value: data.email || '(no email)' },
    { label: 'Recommend score', value: data.recommendScore != null ? String(data.recommendScore) : '' },
    { label: 'Features used', value: (data.featuresUsed || []).join(', ') },
    { label: 'Improvements', value: data.improvements || '' },
    { label: 'Missing features', value: data.missingFeatures || '' },
  ]);
}
