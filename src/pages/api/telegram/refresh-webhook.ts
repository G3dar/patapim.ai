/**
 * One-shot admin endpoint: re-applies the Telegram setWebhook config so the
 * relay's hardcoded URL + current TELEGRAM_WEBHOOK_SECRET + the canonical
 * `allowed_updates` list get pushed to Telegram. Useful when allowed_updates
 * needs to change (e.g. adding callback_query) without the operator having
 * to dig up the bot token or webhook secret out of Cloudflare.
 *
 * No auth: the endpoint can ONLY (a) re-apply the same URL the worker is
 * already configured to receive at, and (b) attach the current secret. It
 * cannot redirect the webhook elsewhere, leak the secret, or change the
 * bot's behavior in any way an attacker could exploit. Worst-case abuse is
 * Telegram-side rate-limiting on setWebhook (~1/sec), which is harmless.
 */

import type { APIRoute } from 'astro';
import { callBotApi } from '../../../lib/telegram/bot-api';

export const prerender = false;

const ALLOWED_UPDATES = ['message', 'callback_query'];

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const token = env.TELEGRAM_BOT_TOKEN;
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) {
    return new Response(JSON.stringify({ ok: false, error: 'Bot token / secret not configured on the worker.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const siteUrl = env.SITE_URL || 'https://patapim.ai';
  const webhookUrl = `${siteUrl}/api/telegram/webhook`;

  try {
    await callBotApi(token, 'setWebhook', {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ALLOWED_UPDATES,
      drop_pending_updates: false,
    });
    const info = await callBotApi(token, 'getWebhookInfo', {});
    return new Response(JSON.stringify({ ok: true, webhook_url: webhookUrl, allowed_updates: ALLOWED_UPDATES, info }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
