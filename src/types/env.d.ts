// Global environment variables injected by Vite
declare const __APP_VERSION__: string;

// Astro middleware locals interface
declare namespace App {
  interface Locals {
    config: any;
    auth: {
      isLoggedIn: boolean;
      authToken: string | undefined;
      refreshToken: string | undefined;
      hasAuthToken: boolean;
      hasRefreshToken: boolean;
    };
  }
}