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
  const config = safeGetConfig();
  if (!config) {
    // Return a fallback config for server-side rendering
    return {
      api_host: 'https://weeb-api.staging.weeb.vip',
      algolia_index: 'fallback',
      cdn_url: 'https://cdn.weeb.vip',
      cdn_user_url: 'https://cdn.weeb.vip',
      flagsmith_environment_id: 'fallback',
      posthog_api_key: 'phc_fallback_key',
    } as any;
  }
  return config;
}

// Export config safely
const config = safeGetConfig();
export default config;
