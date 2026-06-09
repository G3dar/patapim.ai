import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../lib/cors';
import { sendEmail } from '../../lib/email';

export const prerender = false;

const RECIPIENT = 'g@3dar.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BASE64 = 8_000_000;   // ~6MB raw per file
const MAX_TOTAL_ATTACHMENT_BASE64 = 12_000_000; // ~9MB raw total
const MAX_TEXT_FIELD_CHARS = 100_000;

interface AttachmentIn {
  filename?: unknown;
  content?: unknown;
}

interface BugReportBody {
  email?: string;
  description?: string;
  appVersion?: string;
  platform?: string;
  attachments?: AttachmentIn[];
  terminalOutput?: string;
  terminalName?: string;
  consoleLogs?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:"*?<>|\x00-\x1f]+/g, '_').slice(0, 120);
  return cleaned || 'attachment';
}

function truncate(s: string, max: number, label: string): string {
  if (s.length <= max) return s;
  return `[truncated: ${s.length - max} of ${s.length} ${label} chars dropped]\n` + s.slice(-max);
}

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);

  let body: BugReportBody;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const { email, description, appVersion, platform } = body;

  if (!description || description.trim().length < 10) {
    return new Response(JSON.stringify({ error: 'Description must be at least 10 characters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  // Validate + normalize attachments
  const validAttachments: { filename: string; content: string }[] = [];
  if (Array.isArray(body.attachments)) {
    if (body.attachments.length > MAX_ATTACHMENTS) {
      return new Response(JSON.stringify({ error: `Maximum ${MAX_ATTACHMENTS} attachments per report` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }
    let total = 0;
    for (const a of body.attachments) {
      if (!a || typeof a !== 'object') continue;
      const filename = typeof a.filename === 'string' ? sanitizeFilename(a.filename) : `image-${validAttachments.length + 1}.jpg`;
      const content = typeof a.content === 'string' ? a.content : '';
      if (!content) continue;
      if (content.length > MAX_ATTACHMENT_BASE64) {
        return new Response(JSON.stringify({ error: `Attachment "${filename}" is too large` }), {
          status: 413,
          headers: { 'Content-Type': 'application/json', ...cors },
        });
      }
      total += content.length;
      if (total > MAX_TOTAL_ATTACHMENT_BASE64) {
        return new Response(JSON.stringify({ error: 'Total attachments size too large' }), {
          status: 413,
          headers: { 'Content-Type': 'application/json', ...cors },
        });
      }
      validAttachments.push({ filename, content });
    }
  }

  const timestamp = new Date().toISOString();
  const randomId = crypto.randomUUID().slice(0, 8);
  const key = `bug:${timestamp}:${randomId}`;
  const trimmedEmail = email?.trim() || '';
  const trimmedDesc = description.trim();
  const validReplyTo = trimmedEmail && EMAIL_RE.test(trimmedEmail) ? trimmedEmail : undefined;

  const terminalName = typeof body.terminalName === 'string' ? body.terminalName.slice(0, 200) : '';
  const terminalOutputRaw = typeof body.terminalOutput === 'string' ? body.terminalOutput : '';
  const terminalOutput = terminalOutputRaw ? truncate(terminalOutputRaw, MAX_TEXT_FIELD_CHARS, 'terminal') : '';
  const consoleLogsRaw = typeof body.consoleLogs === 'string' ? body.consoleLogs : '';
  const consoleLogs = consoleLogsRaw ? truncate(consoleLogsRaw, MAX_TEXT_FIELD_CHARS, 'console') : '';

  // Persist to KV (full payload, including attachments). KV value cap is 25MB; our caps stay well under.
  const value = {
    type: 'bug',
    email: trimmedEmail,
    description: trimmedDesc,
    appVersion: appVersion || '',
    platform: platform || '',
    timestamp,
    terminalName,
    terminalOutput,
    consoleLogs,
    attachments: validAttachments.map(a => ({ filename: a.filename, sizeBase64: a.content.length })),
  };
  await env.FEEDBACK.put(key, JSON.stringify(value));

  // Build email
  const subjectTag = validReplyTo ? `[PATAPIM bug] ${trimmedEmail}` : '[PATAPIM bug] anonymous';
  const summary = trimmedDesc.length > 80 ? trimmedDesc.slice(0, 80) + '…' : trimmedDesc;
  const attachmentsLabel = validAttachments.length
    ? ` 📎${validAttachments.length}`
    : '';

  const textParts: string[] = [
    `From: ${trimmedEmail || '(no email provided)'}`,
    `Version: ${appVersion || '(unknown)'}`,
    `Platform: ${platform || '(unknown)'}`,
    `Time: ${timestamp}`,
    `KV key: ${key}`,
    `Attachments: ${validAttachments.length}`,
    '',
    trimmedDesc,
  ];
  if (terminalOutput) {
    textParts.push('', `--- TERMINAL: ${terminalName || '(unnamed)'} ---`, terminalOutput);
  }
  if (consoleLogs) {
    textParts.push('', '--- CONSOLE LOGS ---', consoleLogs);
  }
  textParts.push('',
    validReplyTo
      ? `(Reply to this email to respond directly to ${trimmedEmail}.)`
      : '(No reply-to — reporter did not provide an email.)'
  );
  const textBody = textParts.join('\n');

  const sectionStyle = 'background:#f6f6f6;border-left:3px solid #c2410c;padding:14px 16px;white-space:pre-wrap;font-size:13px;line-height:1.5;font-family:ui-monospace,Menlo,Consolas,monospace;max-height:400px;overflow:auto;border-radius:4px;';
  const detailsStyle = 'margin-top:14px;border:1px solid #e5e5e5;border-radius:6px;padding:8px 12px;';
  const summaryStyle = 'cursor:pointer;font-weight:600;color:#374151;font-size:13px;';

  const htmlBody = `<!doctype html>
<html><body style="font-family:system-ui,Segoe UI,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#1a1a1a;">
  <h2 style="margin:0 0 12px 0;color:#c2410c;">🐛 New PATAPIM bug / feature report${attachmentsLabel}</h2>
  <table style="border-collapse:collapse;margin-bottom:16px;font-size:14px;">
    <tr><td style="padding:4px 12px 4px 0;color:#666;">From</td><td><strong>${escapeHtml(trimmedEmail || '(no email provided)')}</strong></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666;">Version</td><td>${escapeHtml(appVersion || '(unknown)')}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666;">Platform</td><td>${escapeHtml(platform || '(unknown)')}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666;">Time</td><td>${escapeHtml(timestamp)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666;">KV key</td><td><code>${escapeHtml(key)}</code></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666;">Attachments</td><td>${validAttachments.length}${validAttachments.length ? ' (see email attachments)' : ''}</td></tr>
  </table>
  <div style="${sectionStyle.replace('font-family:ui-monospace,Menlo,Consolas,monospace;', '')}">${escapeHtml(trimmedDesc)}</div>
  ${terminalOutput ? `
  <details open style="${detailsStyle}">
    <summary style="${summaryStyle}">Terminal: ${escapeHtml(terminalName || '(unnamed)')} (${terminalOutput.length.toLocaleString()} chars)</summary>
    <div style="${sectionStyle}margin-top:8px;">${escapeHtml(terminalOutput)}</div>
  </details>` : ''}
  ${consoleLogs ? `
  <details style="${detailsStyle}">
    <summary style="${summaryStyle}">Console logs (${consoleLogs.length.toLocaleString()} chars)</summary>
    <div style="${sectionStyle}margin-top:8px;">${escapeHtml(consoleLogs)}</div>
  </details>` : ''}
  <p style="color:#666;font-size:13px;margin-top:18px;">
    ${validReplyTo
      ? `Hit <strong>Reply</strong> to respond directly to <strong>${escapeHtml(trimmedEmail)}</strong>.`
      : 'No reply-to — reporter did not provide an email address.'}
  </p>
</body></html>`;

  context.locals.runtime.ctx.waitUntil(
    sendEmail(env, {
      to: RECIPIENT,
      subject: `${subjectTag} — ${summary}`,
      text: textBody,
      html: htmlBody,
      replyTo: validReplyTo,
      attachments: validAttachments.length ? validAttachments : undefined,
    }).catch((e: unknown) => {
      console.error('Bug report email failed', e);
    })
  );

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
};
