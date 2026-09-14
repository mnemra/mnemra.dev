// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://mnemra.dev',
  adapter: cloudflare(),
  integrations: [sitemap()],
  image: {
    layout: 'constrained',
  },
});
