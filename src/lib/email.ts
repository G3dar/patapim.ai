import { welcomeAndVerify, passwordReset, emailVerify } from './emailTemplates';

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

export async function sendPasswordReset(env: ResendEnv, to: string, name: string, resetUrl: string): Promise<void> {
  const t = passwordReset(name, resetUrl);
  await send(env, { to, ...t });
}

export async function sendEmailVerify(env: ResendEnv, to: string, name: string, verifyUrl: string): Promise<void> {
  const t = emailVerify(name, verifyUrl);
  await send(env, { to, ...t });
}
