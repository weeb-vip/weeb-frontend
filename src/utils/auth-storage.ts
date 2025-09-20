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

    document.cookie = cookieString;
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

      // Set secure cookies with proper options
      const cookieOptions = {
        path: '/',
        secure: window.location.protocol === 'https:',
        sameSite: 'Strict' as const,
        maxAge: 7 * 24 * 60 * 60 // 7 days
      };

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
        secure: window.location.protocol === 'https:',
        sameSite: 'Strict' as const,
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
      // Clear cookies
      CookieUtils.remove('authToken');
      CookieUtils.remove('refreshToken');

      debug.auth("Tokens cleared from cookies");
    } catch (error) {
      debug.error("Failed to clear auth tokens:", error);
    }
  }

  // Server-side utility to extract token from cookie string
  static getTokenFromCookieString(cookieString: string | undefined): string | undefined {
    if (!cookieString) return undefined;

    const cookieMatch = cookieString.match(/authToken=([^;]+)/);
    return cookieMatch ? cookieMatch[1] : undefined;
  }
}