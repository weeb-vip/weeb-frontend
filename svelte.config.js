import knativeAdapter from '@weeb-vip/adapter-knative';
import cloudflareAdapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// DEPLOY_TARGET=cloudflare builds for Cloudflare Pages (deploy-cloudflare
// workflow); the default build is what the k8s image runs. adapter-knative
// wraps adapter-node with the Redis page cache the edge tier reads from, and
// emits the same build/index.js + build/client, so the Dockerfile is unchanged.
const adapter = process.env.DEPLOY_TARGET === 'cloudflare'
  ? cloudflareAdapter()
  : knativeAdapter({ out: 'build' });

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
    },
    // Namespaces every cache key, so a deploy cannot serve HTML rendered by the
    // previous build — it references /_app/immutable chunks the new image does
    // not contain. The default is a build timestamp, which is correct but
    // opaque; the release version makes X-Cache debugging and rollback legible.
    //
    // Not adapter-specific: SvelteKit also uses this for its own client-side
    // version-change detection, so it applies to the Cloudflare build too.
    version: { name: process.env.VITE_APP_VERSION || 'dev' }
  }
};

export default config;
