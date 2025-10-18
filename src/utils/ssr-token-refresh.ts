import type { AstroCookies } from 'astro';
import { AuthStorage } from './auth-storage';
import debug from './debug';

interface RefreshTokenResponse {
  success: boolean;
  authToken?: string;
  refreshToken?: string;
  error?: string;
}

/**
 * SSR-side token refresh using refresh token from cookies
 * This function is designed to be called from Astro middleware or server-side components
 */
export async function refreshTokenSSR(
  cookies: AstroCookies,
  graphqlHost: string
): Promise<RefreshTokenResponse> {
  try {
    // Get refresh token from cookies
    const refreshToken = cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      debug.auth('[SSR] No refresh token found in cookies');
      return { success: false, error: 'No refresh token available' };
    }

    debug.auth('[SSR] Attempting token refresh with refresh token');

    // Call the GraphQL refresh token mutation
    const response = await fetch(`${graphqlHost}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        query: `
          mutation RefreshToken($token: String!) {
            RefreshToken(token: $token) {
              id
              Credentials {
                token
                refresh_token
              }
            }
          }
        `,
        variables: { token: refreshToken }
      })
    });

    if (!response.ok) {
      debug.error('[SSR] Token refresh HTTP error:', response.status);
      return {
        success: false,
        error: `HTTP error: ${response.status}`
      };
    }

    const data = await response.json();

    if (data.errors) {
      debug.error('[SSR] Token refresh GraphQL errors:', data.errors);
      return {
        success: false,
        error: data.errors[0]?.message || 'GraphQL error'
      };
    }

    const newAuthToken = data.data?.RefreshToken?.Credentials?.token;
    const newRefreshToken = data.data?.RefreshToken?.Credentials?.refresh_token;

    if (!newAuthToken) {
      debug.error('[SSR] Token refresh succeeded but no auth token returned');
      return {
        success: false,
        error: 'No auth token in response'
      };
    }

    debug.success('[SSR] Token refreshed successfully');

    // Update cookies with new tokens
    // Set auth token with shorter expiry (24 hours)
    cookies.set('auth_token', newAuthToken, {
      path: '/',
      maxAge: 24 * 60 * 60, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    // Also set access_token for compatibility
    cookies.set('access_token', newAuthToken, {
      path: '/',
      maxAge: 24 * 60 * 60,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    // Update refresh token if a new one was provided
    if (newRefreshToken) {
      cookies.set('refresh_token', newRefreshToken, {
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      cookies.set('refresh_token', newRefreshToken, {
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    }

    return {
      success: true,
      authToken: newAuthToken,
      refreshToken: newRefreshToken
    };
  } catch (error) {
    debug.error('[SSR] Token refresh failed with exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Helper to check if a token is expired based on JWT payload
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (typeof payload.exp === 'number') {
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      return now >= expiryTime;
    }
  } catch (error) {
    debug.error('[SSR] Failed to parse token expiry:', error);
  }
  return true; // Assume expired if we can't parse
}
