import path from "node:path";
import type { StorybookConfig } from "storybook/internal/types";
import type { PluginOption } from "vite";

/**
 * Header's four chrome children, and the offline stand-ins Storybook renders
 * instead. See src/svelte/components/__stories__/offline/README.md for why the
 * substitution happens here rather than in the story.
 *
 * Keyed by file name; the swap only applies to imports made *by Header.svelte*,
 * so every other consumer -- AutocompleteAdvanced's own story included --
 * resolves the real module.
 */
const OFFLINE_HEADER_CHROME = [
  "AuthInitializer.svelte",
  "LoginModalHandler.svelte",
  "UserProfileHandler.svelte",
  "AutocompleteAdvanced.svelte",
];

// Storybook is always invoked from the project root (`yarn storybook`,
// `yarn build-storybook`), so cwd is the repo root.
const STUB_DIR = path.resolve(
  process.cwd(),
  "src/svelte/components/__stories__/offline",
);

function offlineHeaderChrome(): PluginOption {
  return {
    name: "weeb-offline-header-chrome",
    // Ahead of vite-plugin-svelte, or the real file is resolved first.
    enforce: "pre",
    resolveId(source: string, importer?: string) {
      if (!importer || !importer.endsWith(path.join("src", "lib", "Header.svelte"))) {
        return null;
      }

      const name = source.split("/").pop();
      if (!name || !OFFLINE_HEADER_CHROME.includes(name)) return null;

      return path.join(STUB_DIR, name);
    },
  };
}

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx|svelte)"],
  // No a11y addon: @storybook/addon-a11y (and axe-core) are not in
  // node_modules, and adding them needs a registry install this environment
  // cannot do. Worth adding the moment there is network for it -- every story
  // in here is a component in isolation, which is where axe is most useful.
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

    config.plugins = [offlineHeaderChrome(), ...(config.plugins ?? [])];

    return config;
  },
};
export default config;
