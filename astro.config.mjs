import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),

  integrations: [
    svelte(),
    tailwind({
      configFile: './tailwind.config.js'
    })
  ],

  // Development server
  server: {
    port: 8083,
    host: '0.0.0.0',
    headers: {
      'Content-Security-Policy': "frame-ancestors 'self' http://localhost:63342 http://127.0.0.1:63342 http://localhost:8083 http://",
      'X-Frame-Options': '' // omit or empty so CSP governs
    }
  },

  // Preview server
  preview: {
    port: 8084,
    host: '0.0.0.0'
  },

  // Minimal Vite config for essential functionality only
  vite: {
    define: {
      global: 'window',
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
