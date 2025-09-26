import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://astro.build/config
export default defineConfig({
  site: 'https://weeb.vip',
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),

  integrations: [
    svelte({
      // Disable experimental async SSR to suppress warnings
      compilerOptions: {
        warningFilter: (warning) => {
          // Suppress experimental async SSR warnings
          return !warning.message.includes('experimental_async_ssr');
        }
      }
    }),
    tailwind({
      configFile: './tailwind.config.js'
    })
  ],

  vite: {
    define: {
      __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || 'dev'),
      __ENABLE_DEV_FEATURES__: process.env.NODE_ENV === 'development'
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
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks
            'vendor-svelte': ['svelte', '@tanstack/svelte-query'],
            'vendor-utils': ['date-fns', 'graphql-request'],
            'vendor-icons': ['@fortawesome/free-solid-svg-icons', '@fortawesome/free-regular-svg-icons'],

            // Feature chunks
            'notifications': ['src/services/animeNotifications.ts', 'src/workers/animeNotifications.worker.ts'],
            'auth': ['src/utils/auth-storage.ts', 'src/svelte/stores/auth.ts'],

            // Page chunks - split by route
            'page-home': ['src/svelte/components/HomepageSSR.svelte', 'src/svelte/components/HeroBanner.svelte'],
            'page-profile': ['src/svelte/components/ProfileContent.svelte'],
            'page-show': ['src/svelte/components/ShowContent.svelte'],
            'page-airing': ['src/svelte/components/CurrentlyAiringDemo.svelte']
          }
        }
      },
      // Optimize chunk size
      chunkSizeWarningLimit: 1000,
      // Enable source maps for better debugging
      sourcemap: false,
      // Minify for production
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: process.env.NODE_ENV === 'production',
          drop_debugger: true
        }
      }
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ['svelte', '@tanstack/svelte-query', 'date-fns', 'graphql-request'],
      exclude: ['@fortawesome/fontawesome-svg-core']
    }
  }
});