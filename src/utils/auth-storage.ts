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

// Cookie-based auth storage (no localStorage)
export class AuthStorage {
  static setTokens(authToken: string, refreshToken: string) {
    try {
      // Only run on client-side
      if (typeof window === 'undefined') return;

      console.log('Storing tokens in cookies:', {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        authTokenLength: authToken.length,
        refreshTokenLength: refreshToken.length
      });

      // More permissive cookie options for debugging
      const cookieOptions = {
        path: '/',
        // Only use secure on production HTTPS
        secure: window.location.protocol === 'https:' && window.location.hostname !== 'localhost',
        sameSite: 'Lax' as const, // Changed from Strict to Lax for better compatibility
        maxAge: 7 * 24 * 60 * 60 // 7 days
      };

      console.log('Cookie options:', cookieOptions);

      CookieUtils.set('authToken', authToken, cookieOptions);
      CookieUtils.set('refreshToken', refreshToken, cookieOptions);

      debug.auth("Tokens stored in cookies");
    } catch (error) {
      debug.error("Failed to store auth tokens:", error);
    }
  }

  static setAuthToken(authToken: string) {
    try {
      // Only run on client-side
      if (typeof window === 'undefined') return;

      const cookieOptions = {
        path: '/',
        secure: window.location.protocol === 'https:' && window.location.hostname !== 'localhost',
        sameSite: 'Lax' as const,
        maxAge: 7 * 24 * 60 * 60 // 7 days
      };

      CookieUtils.set('authToken', authToken, cookieOptions);
      debug.auth("Auth token stored in cookies");
    } catch (error) {
      debug.error("Failed to store auth token:", error);
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
      return CookieUtils.get('refreshToken');
    } catch (error) {
      debug.error("Failed to get refresh token from cookies:", error);
      return null;
    }
  }

  static clearTokens() {
    try {
      console.log("🚨 clearTokens() called - preserving cookies (auth error/refresh scenario)");
      debug.warn("clearTokens() called but cookies preserved (likely auth error, not explicit logout)");

      // Don't clear cookies on auth errors - only on explicit logout
      // Cookies should persist to allow automatic re-auth
    } catch (error) {
      debug.error("Failed to clear auth tokens:", error);
    }
  }

  static logout() {
    try {
      console.log("🚪 logout() called - clearing cookies");
      debug.auth("Explicit logout - removing cookies");

      // Only clear cookies on explicit logout
      CookieUtils.remove('authToken');
      CookieUtils.remove('refreshToken');

      debug.auth("Tokens cleared from cookies on logout");
    } catch (error) {
      debug.error("Failed to clear auth tokens on logout:", error);
    }
  }

  // Server-side utility to extract token from cookie string
  static getTokenFromCookieString(cookieString: string | undefined): string | undefined {
    if (!cookieString) return undefined;

    const cookieMatch = cookieString.match(/authToken=([^;]+)/);
    return cookieMatch ? cookieMatch[1] : undefined;
  }
}