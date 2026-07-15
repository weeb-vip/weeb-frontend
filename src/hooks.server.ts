import { redirect, type Handle } from '@sveltejs/kit';
import { getConfig } from './config/build-time-loader';
import { AuthStorage } from './utils/auth-storage';
import { refreshTokenSSR, isTokenExpired } from './utils/ssr-token-refresh';
import { clearAuthCookies } from '$lib/server/auth-cookies';

// Config cache for performance
let configData: any = null;

// refreshTokenSSR was written against Astro's cookie API (get returns
// {value}, set defaults the path) — adapt SvelteKit's cookies to it
function astroStyleCookies(cookies: import('@sveltejs/kit').Cookies) {
  return {
    get(name: string) {
      const value = cookies.get(name);
      return value === undefined ? undefined : { value };
    },
    set(name: string, value: string, options: any = {}) {
      cookies.set(name, value, { path: '/', ...options });
    },
    delete(name: string, options: any = {}) {
      cookies.delete(name, { path: '/', ...options });
    }
  };
}

export const handle: Handle = async ({ event, resolve }) => {
  const { request, url, cookies } = event;

  // Skip work for static assets (served by the adapter, but belt and braces)
  const isStaticAsset = url.pathname.startsWith('/assets/') ||
                        url.pathname.startsWith('/_app/') ||
                        /\.(png|jpg|ico|webp|svg|css|js|json)$/.test(url.pathname);

  if (isStaticAsset) {
    return resolve(event);
  }

  try {
    if (!configData) {
      configData = await getConfig();
      console.log('[Hooks] Config loaded from build-time import');
      console.log('[Hooks] API Host:', configData?.api_host);
    }
    event.locals.config = configData;
  } catch (error) {
    console.error('[Hooks] Failed to load config:', error);
    return new Response('Configuration error', { status: 500 });
  }

  const cookieString = request.headers.get('cookie') || '';

  // Check authentication status from cookies
  const authResult = (() => {
    const isLoggedIn = AuthStorage.isLoggedInFromCookieString(cookieString);
    const tokens = AuthStorage.getTokensFromCookieString(cookieString);
    return { isLoggedIn, tokens };
  })();

  // Token refresh logic - 3 cases
  const hasAccessToken = !!authResult.tokens.authToken;
  const hasRefreshToken = !!authResult.tokens.refreshToken;
  const cookieShim = astroStyleCookies(cookies);

  // Refresh when there's a refresh token and the access token is missing or
  // expired. On a definitive failure (revoked/expired refresh token) clear
  // the auth cookies so we don't blocking-retry a doomed refresh on every
  // subsequent request; leave them on a transient (network/5xx) failure.
  const needsRefresh = hasRefreshToken &&
    (!hasAccessToken || (authResult.tokens.authToken && isTokenExpired(authResult.tokens.authToken)));

  if (needsRefresh) {
    const refreshResult = await refreshTokenSSR(cookieShim, configData?.graphql_host || 'http://localhost:8079');

    if (refreshResult.success) {
      authResult.tokens.authToken = refreshResult.authToken;
      authResult.tokens.refreshToken = refreshResult.refreshToken || authResult.tokens.refreshToken;
      authResult.isLoggedIn = true;
    } else {
      console.error('[Hooks] ❌ Token refresh failed:', refreshResult.error);
      authResult.isLoggedIn = false;
      if (refreshResult.authError) {
        clearAuthCookies(cookies);
      }
    }
  } else if (hasAccessToken && authResult.tokens.authToken && isTokenExpired(authResult.tokens.authToken)) {
    // Access token expired and no refresh token available
    authResult.isLoggedIn = false;
  }

  event.locals.auth = {
    isLoggedIn: authResult.isLoggedIn,
    authToken: authResult.tokens.authToken,
    refreshToken: authResult.tokens.refreshToken,
    hasAuthToken: !!authResult.tokens.authToken,
    hasRefreshToken: !!authResult.tokens.refreshToken
  };

  // Handle authentication for protected routes
  const protectedRoutes = ['/profile'];
  const authRoutes = ['/auth/login', '/auth/register'];

  if (protectedRoutes.some(route => url.pathname.startsWith(route)) && !authResult.isLoggedIn) {
    redirect(302, '/auth/login');
  }

  if (authRoutes.some(route => url.pathname === route) && authResult.isLoggedIn) {
    redirect(302, '/profile');
  }

  const response = await resolve(event);

  if (response.headers) {
    // Security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Cache control: only anonymous HTML may be publicly cached — a
    // logged-in render is personalized and must never land in a shared
    // cache. Static assets are handled by the adapter before this hook.
    const isAnonymous = !authResult.isLoggedIn && !hasRefreshToken && !hasAccessToken;
    if (url.pathname === '/' || url.pathname === '/airing') {
      response.headers.set(
        'Cache-Control',
        isAnonymous ? 'public, max-age=300, s-maxage=3600' : 'private, no-store'
      );
    }
  }

  return response;
};
