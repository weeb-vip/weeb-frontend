import type { StorybookConfig } from "storybook/internal/types";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx|svelte)"],
  addons: [],
  framework: {
    // This app is SvelteKit. @storybook/svelte-vite refuses to build a
    // SvelteKit project (SB_FRAMEWORK_SVELTE-VITE_0001) -- the sveltekit
    // framework supplies vite-plugin-svelte and the $app/* module mocks
    // itself, so no manual plugin wiring is needed here.
    name: "@storybook/sveltekit",
    options: {},
  },
  async viteFinal(config) {
    // Components read the build-time version global; give stories a stand-in.
    config.define = {
      ...config.define,
      __APP_VERSION__: JSON.stringify('0.0.0-storybook'),
    };

    return config;
  },
};
export default config;
