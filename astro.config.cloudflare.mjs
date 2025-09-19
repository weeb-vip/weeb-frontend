import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    mode: 'directory',
    functionPerRoute: false,
    routes: {
      exclude: ['/favicon.ico', '/robots.txt', '/sitemap.xml', '/_astro/*']
    }
  }),

  integrations: [
    svelte(),
    tailwind({
      configFile: './tailwind.config.js'
    })
  ],

  // Minimal Vite config for essential functionality only
  vite: {
    define: {
      global: 'globalThis',
      __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || 'dev'),
    },

    ssr: {
      noExternal: ['@tanstack/svelte-query', '@tanstack/query-core']
    },

    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: `src/config/static/${process.env.APP_CONFIG || process.env.NODE_ENV || 'development'}/index.json`,
            dest: '',
            rename: 'config.json'
          }
        ]
      })
    ]
  }
});