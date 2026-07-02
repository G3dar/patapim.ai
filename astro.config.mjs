import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://patapim.ai',
  output: 'static',
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  adapter: cloudflare({
    workerEntryPoint: {
      path: 'src/worker.ts',
    },
  }),
  redirects: {
    // the terminal design graduated from /v2 to the homepage
    '/v2': '/',
  },
  integrations: [sitemap({ filter: (page) => !page.includes('/launch') && !page.includes('/classic') })],
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
