/**
 * Discord bot helpers — rotates the public invite link via the Discord Bot API.
 */

interface RotateOk { ok: true; url: string; code: string }
interface RotateErr { ok: false; error: string; status?: number }
export type RotateResult = RotateOk | RotateErr;

interface RotateEnv {
  DISCORD_BOT_TOKEN: string;
  DISCORD_CHANNEL_ID: string;
  LICENSES: KVNamespace;
}

export async function rotateDiscordInvite(env: RotateEnv, source: string): Promise<RotateResult> {
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_CHANNEL_ID) {
    return { ok: false, error: 'Missing DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID' };
  }

  const res = await fetch(`https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/invites`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bot ' + env.DISCORD_BOT_TOKEN,
      'Content-Type': 'application/json',
      'User-Agent': 'PatapimInviteBot (patapim.ai, 0.1)',
    },
    body: JSON.stringify({ max_age: 0, max_uses: 0, unique: true, temporary: false }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, status: res.status, error: `Discord ${res.status}: ${body.slice(0, 300)}` };
  }

  const data = await res.json() as { code: string };
  const url = `https://discord.gg/${data.code}`;
  const now = new Date().toISOString();

  await env.LICENSES.put('discord:invite-url', url);
  await env.LICENSES.put('discord:invite-updated-at', now);
  await env.LICENSES.put('discord:invite-rotated-by', source);

  return { ok: true, url, code: data.code };
}
