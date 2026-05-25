import { App } from 'astro/app';
import { handle } from '@astrojs/cloudflare/handler';
import { rotateDiscordInvite } from './lib/discord';

export { TelegramInstance } from './durable-objects/TelegramInstance';
export { TelegramAccount } from './durable-objects/TelegramAccount';

export function createExports(manifest: any) {
  const app = new App(manifest);

  return {
    default: {
      async fetch(request: Request, env: any, context: any) {
        return await handle(manifest, app, request, env, context);
      },

      async scheduled(_event: any, env: any, ctx: any) {
        ctx.waitUntil(
          rotateDiscordInvite(env, 'cron').then(r => {
            if (r.ok) console.log('[cron] discord invite rotated', r.url);
            else console.error('[cron] discord rotation failed:', r.error);
          })
        );
      },
    },
  };
}
