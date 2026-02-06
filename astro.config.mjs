import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://patapim.ai',
  output: 'static',
  adapter: cloudflare(),
  build: {
    assets: '_assets'
  }
});
