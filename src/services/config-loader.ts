// Config loader that ensures config is loaded before anything else
import type { IConfig } from '../config/interfaces';

let configPromise: Promise<IConfig> | null = null;
let configData: IConfig | null = null;

// Initialize config asynchronously for SSR (Cloudflare Workers compatible)
async function initializeConfigSSR(): Promise<IConfig> {
  console.log('[SSR] 🔧 Environment variables:', {
    NODE_ENV: process.env.NODE_ENV,
    APP_CONFIG: process.env.APP_CONFIG,
    VITE_NODE_ENV: process.env.VITE_NODE_ENV,
  });

  if (configData) {
    console.log('[SSR] 🔧 Using cached config:', configData);
    return configData;
  }

  if (typeof window !== 'undefined') {
    throw new Error('SSR config initialization called in browser context');
  }

  try {
    // In Cloudflare Workers, we need to fetch the config like a client
    // since we don't have filesystem access
    let response;
    let configUrl;

    try {
      // In SSR context, we need absolute URLs since relative URLs don't work
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        configUrl = 'http://localhost:4322/config.json';
      } else {
        // In production/container, construct URL to self-serve the config
        const port = process.env.PORT || '3000';
        configUrl = `http://localhost:${port}/config.json`;
      }
      console.log('[SSR] 🔧 Fetching config from:', configUrl);
      response = await fetch(configUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (fetchError) {
      console.log('[SSR] 🔧 First fetch failed:', fetchError);
      // If that fails, try the absolute URL as fallback
      const baseUrl = globalThis.location?.origin || 'https://weeb-production.pages.dev';
      configUrl = `${baseUrl}/config.json`;
      console.log('[SSR] 🔧 Fallback fetching config from:', configUrl);
      response = await fetch(configUrl);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.status}`);
    }

    configData = await response.json();
    console.log('[SSR] 🔧 Config loaded:', configData);

    // Set on globalThis for compatibility
    // @ts-ignore
    globalThis.config = configData;

    console.log('[SSR] Config loaded successfully');
    return configData;
  } catch (error) {
    console.error('[SSR] Failed to load config:', error);
    throw error;
  }
}

// Initialize config asynchronously for client
async function initializeConfigClient(): Promise<IConfig> {
  if (configData) {
    return configData;
  }

  if (!configPromise) {
    configPromise = fetch('/config.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch config: ${response.status}`);
        }
        return response.json();
      })
      .then((config: IConfig) => {
        configData = config;

        // Set on window.global for compatibility
        // @ts-ignore
        window.global = window.global || {};
        // @ts-ignore
        window.global.config = config;

        // Also set directly on window for easier access
        // @ts-ignore
        window.config = config;

        console.log('[Client] Config loaded successfully');
        return config;
      });
  }

  return configPromise;
}

// Main initialization function
export async function ensureConfigLoaded(): Promise<IConfig> {
  if (configData) {
    return configData;
  }

  if (typeof window === 'undefined') {
    // SSR context - load asynchronously (ESM compatible)
    return await initializeConfigSSR();
  } else {
    // Client context - load asynchronously
    return await initializeConfigClient();
  }
}

// Get config synchronously - throws if not loaded
export function getConfigSync(): IConfig {
  if (!configData) {
    throw new Error('Config not loaded. Call ensureConfigLoaded() first.');
  }
  return configData;
}

// Check if config is loaded
export function isConfigLoaded(): boolean {
  return configData !== null;
}

// For SSR - load config immediately when this module is imported
if (typeof window === 'undefined') {
  // Start loading config but don't block module loading
  initializeConfigSSR().catch(error => {
    console.error('[SSR] Failed to initialize config on module load:', error);
  });
}