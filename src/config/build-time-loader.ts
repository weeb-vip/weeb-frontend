// Build-time config loader - much faster than HTTP calls
import type { IConfig } from './interfaces';

// Import configs directly at build time based on environment
function getEnvironment(): string {
  // Check build-time environment variables
  const appConfig = import.meta.env.APP_CONFIG;
  const nodeEnv = import.meta.env.NODE_ENV;
  const mode = import.meta.env.MODE;

  if (appConfig) return appConfig;
  if (mode === 'development') return 'development';
  if (nodeEnv === 'production') return 'production';
  return 'development';
}

// Import the correct config at build time
async function loadConfig(): Promise<IConfig> {
  const env = getEnvironment();

  console.log(`[Config] Loading ${env} config at build time`);

  try {
    switch (env) {
      case 'production':
        return (await import('./static/production/index.json')).default;
      case 'staging':
        return (await import('./static/staging/index.json')).default;
      case 'development':
        return (await import('./static/development/index.json')).default;
      case 'local':
        return (await import('./static/local/index.json')).default;
      default:
        console.warn(`[Config] Unknown environment: ${env}, falling back to development`);
        return (await import('./static/development/index.json')).default;
    }
  } catch (error) {
    console.error(`[Config] Failed to load ${env} config:`, error);
    // Fallback to development config
    return (await import('./static/development/index.json')).default;
  }
}

// Cache the config promise
let configPromise: Promise<IConfig> | null = null;
let configData: IConfig | null = null;

// Main export - loads config once and caches it
export async function getConfig(): Promise<IConfig> {
  if (configData) {
    return configData;
  }

  if (!configPromise) {
    configPromise = loadConfig().then(config => {
      configData = config;
      return config;
    });
  }

  return configPromise;
}

// Synchronous getter - throws if not loaded
export function getConfigSync(): IConfig {
  if (!configData) {
    throw new Error('Config not loaded. Call getConfig() first.');
  }
  return configData;
}

// Check if config is loaded
export function isConfigLoaded(): boolean {
  return configData !== null;
}