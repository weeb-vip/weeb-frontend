import { type IConfig } from './interfaces'

// Safe config access for server-side rendering
function safeGetConfig(): IConfig | null {
  if (typeof global !== 'undefined' && (global as any).config) {
    return (global as any).config;
  }
  if (typeof window !== 'undefined' && (window as any).config) {
    return (window as any).config;
  }
  return null;
}

export function getConfig(): IConfig {
  console.log('[CONFIG] 🔧 getConfig() called');
  console.log('[CONFIG] 🔧 Environment:', {
    DEV: import.meta.env.DEV,
    MODE: import.meta.env.MODE,
    isServer: typeof window === 'undefined'
  });

  const config = safeGetConfig();
  console.log('[CONFIG] 🔧 safeGetConfig result:', config);

  if (!config) {
    console.log('[CONFIG] 🔧 No config found, using fallback');
    const fallbackConfig = {
      api_host: 'https://weeb-api.staging.weeb.vip',
      graphql_host: 'https://gateway.staging.weeb.vip/graphql',
      algolia_index: 'fallback',
      cdn_url: 'https://cdn.weeb.vip',
      cdn_user_url: 'https://cdn.weeb.vip',
      posthog_api_key: 'phc_fallback_key',
    } as any;
    console.log('[CONFIG] 🔧 Fallback config:', fallbackConfig);
    return fallbackConfig;
  }

  console.log('[CONFIG] 🔧 Returning config:', config);
  return config;
}

// Export config safely
const config = safeGetConfig();
export default config;
