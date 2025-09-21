import debug from './debug';

// Cookie utility functions
class CookieUtils {
  static get(name: string): string | null {
    if (typeof document === 'undefined') return null;

    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  static set(name: string, value: string, options: { expires?: Date; maxAge?: number; path?: string; secure?: boolean; sameSite?: string } = {}) {
    if (typeof document === 'undefined') return;

    let cookieString = `${name}=${value}`;

    if (options.expires) {
      cookieString += `; Expires=${options.expires.toUTCString()}`;
    }
    if (options.maxAge) {
      cookieString += `; Max-Age=${options.maxAge}`;
    }
    if (options.path) {
      cookieString += `; Path=${options.path}`;
    }
    if (options.secure) {
      cookieString += `; Secure`;
    }
    if (options.sameSite) {
      cookieString += `; SameSite=${options.sameSite}`;
    }

    console.log(`Setting cookie: ${cookieString}`);
    document.cookie = cookieString;

    // Verify it was set
    setTimeout(() => {
      const value = CookieUtils.get(name);
      console.log(`Cookie ${name} verification:`, value ? 'SUCCESS' : 'FAILED');
    }, 100);
  }

  static remove(name: string, path: string = '/') {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=; Path=${path}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

// Server-set cookie auth storage (read-only)
export class AuthStorage {
  // ⚠️ REMOVED: Manual cookie setting - server sets HttpOnly cookies
  // static setTokens() - Tokens are now set by the server during login/refresh
  // static setAuthToken() - Server handles all cookie management

  static getAuthToken(): string | null {
    try {
      return CookieUtils.get('authToken');
    } catch (error) {
      debug.error("Failed to get auth token from cookies:", error);
      return null;
    }
  }

  static getRefreshToken(): string | null {
    try {
      return CookieUtils.get('refreshToken');
    } catch (error) {
      debug.error("Failed to get refresh token from cookies:", error);
      return null;
    }
  }

  static isLoggedIn(): boolean {
    try {
      const authToken = CookieUtils.get('authToken');
      const refreshToken = CookieUtils.get('refreshToken');

      console.log('🔍 Checking login status:', {
        authToken: authToken ? 'Present' : 'Missing',
        refreshToken: refreshToken ? 'Present' : 'Missing'
      });

      // User is logged in if they have either an auth token or refresh token
      return !!(authToken || refreshToken);
    } catch (error) {
      debug.error("Failed to check login status:", error);
      return false;
    }
  }

  static clearTokens() {
    try {
      console.log("🚨 clearTokens() called - server manages cookies, client does nothing");
      debug.warn("clearTokens() called but server manages all cookies");

      // Server-set HttpOnly cookies can't be cleared by client JavaScript
      // Auth errors are handled by server-side logic
    } catch (error) {
      debug.error("Failed to clear auth tokens:", error);
    }
  }

  static logout() {
    try {
      console.log("🚪 logout() called - server will clear cookies");
      debug.auth("Logout - server will handle cookie removal");

      // HttpOnly cookies can only be cleared by the server
      // The logout endpoint should clear the cookies
      // Client just needs to call the logout API
    } catch (error) {
      debug.error("Failed to handle logout:", error);
    }
  }

  // Server-side utility to extract token from cookie string
  static getTokenFromCookieString(cookieString: string | undefined): string | undefined {
    if (!cookieString) return undefined;

    const cookieMatch = cookieString.match(/authToken=([^;]+)/);
    return cookieMatch ? cookieMatch[1] : undefined;
  }

  // Server-side utility to check if user is authenticated
  static isLoggedInFromCookieString(cookieString: string | undefined): boolean {
    if (!cookieString) return false;

    // Check for both old and new cookie names
    const authToken = cookieString.match(/authToken=([^;]+)/);
    const refreshToken = cookieString.match(/refreshToken=([^;]+)/);
    const accessToken = cookieString.match(/access_token=([^;]+)/);

    return !!(authToken || refreshToken || accessToken);
  }

  // Server-side utility to get both tokens from cookie string
  static getTokensFromCookieString(cookieString: string | undefined): { authToken?: string; refreshToken?: string } {
    if (!cookieString) return {};

    // Check for both old and new cookie names
    const authMatch = cookieString.match(/authToken=([^;]+)/);
    const refreshMatch = cookieString.match(/refreshToken=([^;]+)/);
    const accessMatch = cookieString.match(/access_token=([^;]+)/);

    return {
      authToken: authMatch ? authMatch[1] : (accessMatch ? accessMatch[1] : undefined),
      refreshToken: refreshMatch ? refreshMatch[1] : undefined
    };
  }
}