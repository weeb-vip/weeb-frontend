// Brings in App.Platform, which is where `platform.cache` is declared. Only
// svelte.config.js references the adapter otherwise, and that is plain JS, so
// nothing would put these types in the program.
/// <reference types="@weeb-vip/adapter-knative" />

declare global {
  namespace App {
    interface Locals {
      config: any;
      auth: {
        isLoggedIn: boolean;
        authToken?: string;
        refreshToken?: string;
        hasAuthToken: boolean;
        hasRefreshToken: boolean;
      };
    }
  }

  declare const __APP_VERSION__: string;
  declare const __ENABLE_DEV_FEATURES__: boolean;
}

export {};
