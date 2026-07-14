import nodeAdapter from '@sveltejs/adapter-node';
import cloudflareAdapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// DEPLOY_TARGET=cloudflare builds for Cloudflare Pages (deploy-cloudflare
// workflow); the default node build is what the k8s image runs
const adapter = process.env.DEPLOY_TARGET === 'cloudflare'
  ? cloudflareAdapter()
  : nodeAdapter({ out: 'build' });

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  compilerOptions: {
    warningFilter: (warning) => !warning.message.includes('experimental_async_ssr')
  },
  kit: {
    adapter,
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
