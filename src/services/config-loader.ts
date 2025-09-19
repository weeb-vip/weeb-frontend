// Config loader that ensures config is loaded before anything else
import type { IConfig } from '../config/interfaces';

let configPromise: Promise<IConfig> | null = null;
let configData: IConfig | null = null;

// Initialize config asynchronously for SSR (ESM compatibility)
async function initializeConfigSSR(): Promise<IConfig> {
  if (configData) {
    return configData;
  }

  if (typeof window !== 'undefined') {
    throw new Error('SSR config initialization called in browser context');
  }

  try {
    // Use dynamic import for ESM compatibility in built environment
    const fs = await import('node:fs');
    const path = await import('node:path');

    // Get ESM equivalent of __dirname
    const currentDir = path.dirname(new URL(import.meta.url).pathname);

    // Try multiple possible paths for config.json
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'config.json'),
      path.join(process.cwd(), 'dist', 'server', 'config.json'),
      path.join(process.cwd(), 'dist', 'client', 'config.json'),
      path.join(currentDir, '..', '..', 'public', 'config.json'),
      path.join(currentDir, '..', '..', 'dist', 'server', 'config.json'),
      path.join(currentDir, '..', '..', 'dist', 'client', 'config.json')
    ];

    console.log(`[SSR] Current working directory: ${process.cwd()}`);
    console.log(`[SSR] Module directory: ${currentDir}`);
    console.log(`[SSR] Trying paths:`, possiblePaths);

    for (const tryPath of possiblePaths) {
      try {
        console.log(`[SSR] Checking: ${tryPath}, exists: ${fs.existsSync(tryPath)}`);
        if (fs.existsSync(tryPath)) {
          const data = fs.readFileSync(tryPath, 'utf8');
          configData = JSON.parse(data);

          // Set on global for compatibility
          // @ts-ignore
          global.config = configData;

          // Also set on globalThis for broader compatibility
          // @ts-ignore
          globalThis.config = configData;

          console.log(`[SSR] Config loaded from: ${tryPath}`);
          return configData;
        }
      } catch (err) {
        continue;
      }
    }

    throw new Error('[SSR] Config file not found in any expected paths');
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