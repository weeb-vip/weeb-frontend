import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  compilerOptions: {
    warningFilter: (warning) => !warning.message.includes('experimental_async_ssr')
  },
  kit: {
    adapter: adapter({ out: 'build' }),
    files: {
      assets: 'public'
    },
    alias: {
      $components: 'src/svelte/components',
      $stores: 'src/svelte/stores'
    }
  }
};

export default config;
