import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || 'dev'),
    __ENABLE_DEV_FEATURES__: process.env.NODE_ENV === 'development',
    // vite only exposes VITE_-prefixed vars on import.meta.env; the config
    // loader branches on APP_CONFIG, so bake it in explicitly
    'import.meta.env.APP_CONFIG': JSON.stringify(process.env.APP_CONFIG || '')
  },
  plugins: [
    sveltekit(),
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
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        // keep console.error/console.warn: they are the only production
        // logging the k8s pods and workers emit
        pure_funcs: process.env.NODE_ENV === 'production'
          ? ['console.log', 'console.debug', 'console.info']
          : [],
        drop_debugger: true
      }
    }
  },
  ssr: {
    noExternal: ['@tanstack/svelte-query', '@tanstack/query-core']
  },
  optimizeDeps: {
    include: ['@tanstack/svelte-query', 'date-fns', 'graphql-request'],
    exclude: ['@fortawesome/fontawesome-svg-core']
  }
});
