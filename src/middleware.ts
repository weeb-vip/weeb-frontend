import { defineMiddleware } from 'astro:middleware';
import { getConfig } from './config/build-time-loader';
import { AuthStorage } from './utils/auth-storage';
import { refreshTokenSSR } from './utils/ssr-token-refresh';

// Config cache for performance - but loaded inside handler for Cloudflare Pages compatibility
let configData: any = null;

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url, cookies } = context;

  // Skip middleware for static assets (huge performance improvement)
  const isStaticAsset = url.pathname.startsWith('/assets/') ||
                        url.pathname.startsWith('/_astro/') ||
                        url.pathname.includes('.png') ||
                        url.pathname.includes('.jpg') ||
                        url.pathname.includes('.ico') ||
                        url.pathname.includes('.webp') ||
                        url.pathname.includes('.svg') ||
                        url.pathname.includes('.css') ||
                        url.pathname.includes('.js') ||
                        url.pathname.includes('.json');

  if (isStaticAsset) {
    return next();
  }

  const startTime = Date.now();

  // Ensure config is available - build-time loading (much faster!)
  try {
    // Load config on first request and cache it
    if (!configData) {
      configData = await getConfig();
      console.log('[Middleware] Config loaded from build-time import');
    }

    // Make config available in Astro locals for components to access
    context.locals.config = configData;
  } catch (error) {
    console.error('[Middleware] Failed to load config:', error);
    return new Response('Configuration error', { status: 500 });
  }

  // Extract cookies from request headers
  const cookieString = request.headers.get('cookie') || '';

  // Only do expensive logging in development
  if (import.meta.env.DEV) {
    // Debug: Log cookie and header information
    const cookieNames = cookieString ? cookieString.split(';').map(c => c.trim().split('=')[0]) : [];

    // Parse cookies to extract token values (masked for security)
    const parsedCookies: Record<string, string> = {};
    if (cookieString) {
      cookieString.split(';').forEach(cookie => {
        const [name, ...valueParts] = cookie.trim().split('=');
        const value = valueParts.join('=');
        if (name && value) {
          // Mask sensitive tokens but show first/last few chars
          if (name === 'authToken' || name === 'refreshToken') {
            parsedCookies[name] = value.length > 10
              ? `${value.substring(0, 5)}...${value.substring(value.length - 5)}`
              : value;
          } else {
            parsedCookies[name] = value;
          }
        }
      });
    }

    console.log('[Middleware] Request debug:', {
      hasCookieHeader: !!request.headers.get('cookie'),
      cookieLength: cookieString.length,
      cookieNames: cookieNames,
      parsedCookies: parsedCookies,
      url: url.pathname,
      host: request.headers.get('host'),
      'x-forwarded-host': request.headers.get('x-forwarded-host'),
      'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
      'x-forwarded-for': request.headers.get('x-forwarded-for'),
      'x-original-host': request.headers.get('x-original-host'),
      hasAuthToken: cookieString.includes('authToken='),
      hasRefreshToken: cookieString.includes('refreshToken='),
      hasAccessToken: cookieString.includes('access_token='),
      // Show full cookie string for debugging (be careful with sensitive data)
      fullCookieString: cookieString || 'none'
    });
  }

  // Check authentication status from cookies
  let authResult = (() => {
    const isLoggedIn = AuthStorage.isLoggedInFromCookieString(cookieString);
    const tokens = AuthStorage.getTokensFromCookieString(cookieString);
    return { isLoggedIn, tokens };
  })();

  // Verify token validity by calling user details endpoint
  if (authResult.tokens.authToken && authResult.isLoggedIn) {
    try {
      const userDetailsResponse = await fetch(`${configData?.api_host || 'http://localhost:8079'}/user`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookieString
        },
        credentials: 'include'
      });

      // If token is invalid (401/403), attempt to refresh
      if (userDetailsResponse.status === 401 || userDetailsResponse.status === 403) {
        console.log('[Middleware] Auth token is invalid (status: %d), attempting refresh', userDetailsResponse.status);

        if (authResult.tokens.refreshToken) {
          const refreshResult = await refreshTokenSSR(cookies, configData?.api_host || 'http://localhost:8079');

          if (refreshResult.success) {
            console.log('[Middleware] Token refreshed successfully after validation failure');
            // Update auth result with new tokens
            authResult.tokens.authToken = refreshResult.authToken;
            authResult.tokens.refreshToken = refreshResult.refreshToken || authResult.tokens.refreshToken;
            authResult.isLoggedIn = true;
          } else {
            console.log('[Middleware] Token refresh failed:', refreshResult.error);
            // Token refresh failed, mark as logged out
            authResult.isLoggedIn = false;
          }
        } else {
          console.log('[Middleware] Auth token invalid but no refresh token available');
          authResult.isLoggedIn = false;
        }
      } else if (!userDetailsResponse.ok) {
        console.log('[Middleware] User details fetch failed with status:', userDetailsResponse.status);
        // Other errors (500, etc.) - don't invalidate auth, might be temporary
      } else {
        // Token is valid, user details fetched successfully
        if (import.meta.env.DEV) {
          console.log('[Middleware] Auth token validated successfully');
        }
      }
    } catch (error) {
      console.error('[Middleware] Failed to verify token:', error);
      // Network error or other issues - don't invalidate auth
    }
  }

  // Make auth info available to all components via Astro.locals
  context.locals.auth = {
    isLoggedIn: authResult.isLoggedIn,
    authToken: authResult.tokens.authToken,
    refreshToken: authResult.tokens.refreshToken,
    hasAuthToken: !!authResult.tokens.authToken,
    hasRefreshToken: !!authResult.tokens.refreshToken
  };

  // Log requests in development
  if (import.meta.env.DEV) {
    console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname}`);
  }

  // Handle authentication for protected routes
  const protectedRoutes = ['/profile'];
  const authRoutes = ['/auth/login', '/auth/register'];

  if (protectedRoutes.some(route => url.pathname.startsWith(route))) {
    // Server-side auth check for protected routes
    if (!authResult.isLoggedIn) {
      // Redirect to login page if not authenticated
      return context.redirect('/auth/login');
    }
  }

  // Redirect authenticated users away from auth pages
  if (authRoutes.some(route => url.pathname === route)) {
    // If user is already authenticated, redirect to home or profile
    if (authResult.isLoggedIn) {
      return context.redirect('/profile');
    }
  }

  // Process the response
  const response = await next();

  if (response.headers) {
    // Security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Cache control for different types of content
    if (url.pathname.startsWith('/assets/') || url.pathname.includes('.')) {
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (url.pathname === '/' || url.pathname === '/airing') {
      response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
    }
  }

  // Skip HTML modification - config is already available via Astro.locals
  // This saves significant processing time on every HTML response

  return response;
});