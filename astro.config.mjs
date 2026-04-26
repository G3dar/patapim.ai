import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://patapim.ai',
  output: 'static',
  adapter: cloudflare({
    workerEntryPoint: {
      path: 'src/worker.ts',
    },
  }),
  integrations: [sitemap()],
  build: {
    assets: '_assets'
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ja'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
