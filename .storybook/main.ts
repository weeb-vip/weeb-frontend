import type { StorybookConfig } from "storybook/internal/types";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx|svelte)"],
  addons: [],
  framework: {
    name: "@storybook/svelte-vite",
    options: {},
  },
  async viteFinal(config) {
    // The @storybook/svelte-vite preset does NOT add vite-plugin-svelte.
    // It expects SvelteKit to provide it, but this project uses Astro.
    // We must add it explicitly.
    const { svelte } = await import('@sveltejs/vite-plugin-svelte');

    // Remove the docgen plugin — svelte2tsx can't parse Svelte 5
    config.plugins = [
      svelte(),
      ...(config.plugins || []).flat().filter((p: any) =>
        !(p?.name === 'storybook:svelte-docgen-plugin')
      ),
    ];

    // Define globals used by components
    config.define = {
      ...config.define,
      __APP_VERSION__: JSON.stringify('0.0.0-storybook'),
    };

    return config;
  },
};
export default config;
