import debug from './debug';

// Utility functions for handling auth token storage in both localStorage and cookies
export class AuthStorage {
  static setTokens(authToken: string, refreshToken: string) {
    try {
      // Only run on client-side
      if (typeof window === 'undefined') return;

      // Store in localStorage for client-side access
      localStorage.setItem("authToken", authToken);
      localStorage.setItem("refreshToken", refreshToken);

      // Also set as HTTP-only cookies for SSR access
      document.cookie = `authToken=${authToken}; Path=/; Secure; SameSite=Strict`;
      document.cookie = `refreshToken=${refreshToken}; Path=/; Secure; SameSite=Strict`;

      debug.auth("Tokens stored in localStorage and cookies");
    } catch (error) {
      debug.error("Failed to store auth tokens:", error);
    }
  }

  static getAuthToken(): string | null {
    try {
      // Only run on client-side
      if (typeof window === 'undefined') return null;
      return localStorage.getItem("authToken");
    } catch (error) {
      debug.error("Failed to get auth token from localStorage:", error);
      return null;
    }
  }

  static getRefreshToken(): string | null {
    try {
      // Only run on client-side
      if (typeof window === 'undefined') return null;
      return localStorage.getItem("refreshToken");
    } catch (error) {
      debug.error("Failed to get refresh token from localStorage:", error);
      return null;
    }
  }

  static clearTokens() {
    try {
      // Only run on client-side
      if (typeof window === 'undefined') return;

      // Clear localStorage
      localStorage.removeItem("authToken");
      localStorage.removeItem("refreshToken");

      // Clear cookies by setting them to expire
      document.cookie = "authToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT";

      debug.auth("Tokens cleared from localStorage and cookies");
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