import { defineMiddleware } from 'astro:middleware';
import { ensureConfigLoaded } from './services/config-loader';
import { AuthStorage } from './utils/auth-storage';
import {
  initTelemetry,
  withSpan,
  recordSSRRequest,
  recordSSRDuration,
  recordAuthCheckDuration
} from './utils/telemetry';

// Initialize OpenTelemetry
if (typeof window === 'undefined') {
  initTelemetry().catch(error => {
    console.warn('Failed to initialize telemetry:', error);
  });
}

// Ensure config is loaded at startup for SSR - load once and cache
let configData: any = null;
let configLoadPromise: Promise<any> | null = null;

if (typeof window === 'undefined') {
  configLoadPromise = ensureConfigLoaded()
    .then(config => {
      configData = config;
      console.log('[Middleware] Config loaded at startup');
      return config;
    })
    .catch(error => {
      console.error('[Middleware] Failed to load config at startup:', error);
      throw error;
    });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url, cookies } = context;
  const startTime = Date.now();

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

  // Track SSR request
  recordSSRRequest({
    path: url.pathname,
    method: request.method,
  });

  // Wrap the entire middleware in a span
  return withSpan(
    'middleware.onRequest',
    async (span) => {
      span.setAttributes({
        'http.url': url.href,
        'http.method': request.method,
        'http.route': url.pathname,
      });

      // Ensure config is available - use cached version
      try {
        // If config hasn't loaded yet, wait for the startup promise
        if (!configData && configLoadPromise) {
          configData = await configLoadPromise;
        }

        // If still no config, try loading (fallback)
        if (!configData) {
          configData = await ensureConfigLoaded();
        }

        // Make config available in Astro locals for components to access
        context.locals.config = configData;
      } catch (error) {
        console.error('[Middleware] Failed to load config:', error);
        span.setStatus({ code: 2, message: 'Config load failed' });
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
  const authStart = Date.now();
  const authResult = await withSpan('auth.check', async () => {
    const isLoggedIn = AuthStorage.isLoggedInFromCookieString(cookieString);
    const tokens = AuthStorage.getTokensFromCookieString(cookieString);
    return { isLoggedIn, tokens };
  });

  recordAuthCheckDuration(Date.now() - authStart, {
    isLoggedIn: authResult.isLoggedIn,
    hasAuthToken: !!authResult.tokens.authToken,
    hasRefreshToken: !!authResult.tokens.refreshToken,
  });

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

      // Record total SSR duration
      recordSSRDuration(Date.now() - startTime, {
        path: url.pathname,
        method: request.method,
        statusCode: response.status,
        isLoggedIn: context.locals.auth?.isLoggedIn || false,
      });

      span.setAttributes({
        'http.status_code': response.status,
        'ssr.duration': Date.now() - startTime,
      });

      return response;
    }
  );
});