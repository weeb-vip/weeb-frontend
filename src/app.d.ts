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
