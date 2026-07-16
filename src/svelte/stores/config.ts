import { writable, derived } from 'svelte/store';
import type { IConfig } from '../../config/interfaces';

// Create a writable store for config
function createConfigStore() {
  const { subscribe, set: _set, update } = writable<IConfig | null>(null);
  // Mirror the current value so init()/get() can read it synchronously.
  let current: IConfig | null = null;
  const set = (config: IConfig | null) => { current = config; _set(config); };
  let isLoading = false;
  let loadPromise: Promise<IConfig | null> | null = null;

  return {
    subscribe,
    // Populate synchronously from the server-provided (build-time) config that
    // the root layout already loads, so the client never re-fetches
    // /config.json. Idempotent — the first non-null value wins.
    hydrate: (config: IConfig | null | undefined) => {
      if (config && !current) set(config);
    },
    // Ensure config is available. Returns immediately once hydrated (the common
    // case); only falls back to an HTTP fetch if nothing populated the store.
    init: async () => {
      if (current) return current;

      // Prevent multiple simultaneous loads
      if (isLoading && loadPromise) {
        return loadPromise;
      }

      isLoading = true;
      loadPromise = fetch('/config.json')
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch config: ${response.status}`);
          }
          return response.json();
        })
        .then((config: IConfig) => {
          console.log('Loaded config from HTTP:', config);
          set(config);

          // Also set it on window.global for compatibility with React components
          if (typeof window !== 'undefined') {
            (window as any).global = (window as any).global || {};
            (window as any).global.config = config;
          }

          isLoading = false;
          return config;
        })
        .catch(error => {
          console.error('Failed to load config:', error);

          // Fallback config for development
          const fallbackConfig: IConfig = {
            api_host: 'https://weeb-api.staging.weeb.vip',
            graphql_host: 'https://gateway.staging.weeb.vip/graphql',
            algolia_index: 'anime-staging',
            cdn_url: 'https://cdn.weeb.vip',
            cdn_user_url: 'https://cdn.weeb.vip',
          } as any;

          console.log('Using fallback config:', fallbackConfig);
          set(fallbackConfig);
          isLoading = false;
          return fallbackConfig;
        });

      return loadPromise;
    },
    // Update config if needed
    setConfig: (config: IConfig) => set(config),
    // Get the current config synchronously
    get: (): IConfig | null => current
  };
}

// Create the config store instance
export const configStore = createConfigStore();

// Derived stores for specific config values
export const algoliaIndex = derived(
  configStore,
  $config => $config?.algolia_index || 'anime-staging'
);

export const apiHost = derived(
  configStore,
  $config => $config?.api_host || 'https://weeb-api.staging.weeb.vip'
);

export const cdnUrl = derived(
  configStore,
  $config => $config?.cdn_url || 'https://cdn.weeb.vip'
);

export const cdnUserUrl = derived(
  configStore,
  $config => $config?.cdn_user_url || 'https://cdn.weeb.vip'
);
