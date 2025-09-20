import { writable, derived } from 'svelte/store';
import type { IConfig } from '../../config/interfaces';

// Create a writable store for config
function createConfigStore() {
  const { subscribe, set, update } = writable<IConfig | null>(null);
  let isLoading = false;
  let loadPromise: Promise<IConfig | null> | null = null;

  return {
    subscribe,
    // Initialize the config store by fetching from HTTP
    init: async () => {
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
            flagsmith_environment_id: 'fallback',
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
    // Get specific config value synchronously
    get: (): IConfig | null => {
      let value: IConfig | null = null;
      subscribe(val => value = val)();
      return value;
    }
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
