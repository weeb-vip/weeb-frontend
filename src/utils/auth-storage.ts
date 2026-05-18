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

// Server-set cookie auth storage (read-only) with localStorage fallback for refresh tokens
export class AuthStorage {
  // ⚠️ REMOVED: Manual cookie setting - server sets HttpOnly cookies
  // static setTokens() - Tokens are now set by the server during login/refresh
  // static setAuthToken() - Server handles all cookie management

  // 🌍 Localhost development: Manually set cookies when server doesn't
  static setTokensForLocalhost(authToken: string, refreshToken?: string): void {
    if (typeof window === 'undefined') return;

    // Only set cookies for localhost development
    const isLocalhost = window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.includes('localhost');

    if (!isLocalhost) {
      debug.auth('Not localhost - skipping manual cookie setting');
      return;
    }

    debug.auth('🏠 Localhost detected - setting authentication cookies manually');

    // Set access token cookie (accessible by JavaScript for development)
    if (authToken) {
      CookieUtils.set('access_token', authToken, {
        path: '/',
        maxAge: 24 * 60 * 60, // 24 hours
        sameSite: 'Lax'
      });
      // Also set the legacy cookie name for compatibility
      CookieUtils.set('authToken', authToken, {
        path: '/',
        maxAge: 24 * 60 * 60, // 24 hours
        sameSite: 'Lax'
      });
    }

    // Set refresh token cookie if provided
    if (refreshToken) {
      CookieUtils.set('refresh_token', refreshToken, {
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        sameSite: 'Lax'
      });
      // Also set the expected cookie name
      CookieUtils.set('refreshToken', refreshToken, {
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        sameSite: 'Lax'
      });
    }

    debug.auth('🍪 Localhost authentication cookies set successfully');
  }

  // LocalStorage methods for refresh token (fallback when cookies aren't available)
  static setRefreshTokenLocalStorage(refreshToken: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('refreshToken', refreshToken);
        debug.auth('Refresh token stored in localStorage as fallback');
      }
    } catch (error) {
      debug.error('Failed to store refresh token in localStorage:', error);
    }
  }

  static getRefreshTokenLocalStorage(): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('refreshToken');
      }
    } catch (error) {
      debug.error('Failed to get refresh token from localStorage:', error);
    }
    return null;
  }

  static clearRefreshTokenLocalStorage(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('refreshToken');
        debug.auth('Refresh token cleared from localStorage');
      }
    } catch (error) {
      debug.error('Failed to clear refresh token from localStorage:', error);
    }
  }


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
      // First try to get from cookies (server-set HttpOnly)
      const cookieToken = CookieUtils.get('refreshToken');
      if (cookieToken) {
        return cookieToken;
      }

      // Fallback to localStorage if cookie not available
      const localStorageToken = this.getRefreshTokenLocalStorage();
      if (localStorageToken) {
        debug.auth('Using refresh token from localStorage fallback');
        return localStorageToken;
      }

      return null;
    } catch (error) {
      debug.error("Failed to get refresh token:", error);
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
      console.log("🚨 clearTokens() called - server manages cookies, preserving refresh token in localStorage");
      debug.warn("clearTokens() called - server manages cookies, preserving refresh token for recovery");

      // DO NOT clear refresh token from localStorage - preserve it for token refresh attempts
      // this.clearRefreshTokenLocalStorage(); // REMOVED - preserve refresh token

      // Server-set HttpOnly cookies can't be cleared by client JavaScript
      // Auth errors are handled by server-side logic
      // Refresh token in localStorage remains for automatic recovery
    } catch (error) {
      debug.error("Failed to clear auth tokens:", error);
    }
  }

  static logout() {
    try {
      console.log("🚪 logout() called - server will clear cookies, clearing localStorage");
      debug.auth("Logout - server will handle cookie removal, clearing localStorage tokens");

      // Clear localStorage tokens on intentional logout
      this.clearRefreshTokenLocalStorage();

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
    const refreshMatch = cookieString.match(/refresh_token=([^;]+)/);
    const accessMatch = cookieString.match(/access_token=([^;]+)/);

    return {
      authToken: authMatch ? authMatch[1] : (accessMatch ? accessMatch[1] : undefined),
      refreshToken: refreshMatch ? refreshMatch[1] : undefined
    };
  }
}
