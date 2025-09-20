import { defineMiddleware } from 'astro:middleware';
import { ensureConfigLoaded } from './services/config-loader';
import { AuthStorage } from './utils/auth-storage';

// Ensure config is loaded at startup for SSR
let configLoadPromise: Promise<any> | null = null;

if (typeof window === 'undefined') {
  configLoadPromise = ensureConfigLoaded().catch(error => {
    console.error('[Middleware] Failed to load config at startup:', error);
    throw error;
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url, cookies } = context;

  // Ensure config is loaded before processing any request
  try {
    const config = await ensureConfigLoaded();

    // Make config available in Astro locals for components to access
    context.locals.config = config;
  } catch (error) {
    console.error('[Middleware] Failed to load config:', error);
    return new Response('Configuration error', { status: 500 });
  }

  // Extract cookies from request headers
  const cookieString = request.headers.get('cookie') || '';

  // Debug: Log cookie information
  console.log('[Middleware] Cookie debug:', {
    hasCookieHeader: !!request.headers.get('cookie'),
    cookieLength: cookieString.length,
    url: url.pathname,
    host: request.headers.get('host')
  });

  // Check authentication status from cookies
  const isLoggedIn = AuthStorage.isLoggedInFromCookieString(cookieString);
  const tokens = AuthStorage.getTokensFromCookieString(cookieString);

  // Make auth info available to all components via Astro.locals
  context.locals.auth = {
    isLoggedIn,
    authToken: tokens.authToken,
    refreshToken: tokens.refreshToken,
    hasAuthToken: !!tokens.authToken,
    hasRefreshToken: !!tokens.refreshToken
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
    if (!isLoggedIn) {
      // Redirect to login page if not authenticated
      return context.redirect('/auth/login');
    }
  }

  // Redirect authenticated users away from auth pages
  if (authRoutes.some(route => url.pathname === route)) {
    // If user is already authenticated, redirect to home or profile
    if (isLoggedIn) {
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

  // For HTML responses, inject config into the page
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/html')) {
    try {
      const config = context.locals.config;
      if (config) {
        // Clone the response to avoid "body already used" error
        const clonedResponse = response.clone();
        const html = await clonedResponse.text();
        const configScript = `<script>window.config = ${JSON.stringify(config)}; if (typeof global !== 'undefined') { global.config = window.config; }</script>`;

        // Inject the script before the closing head tag
        const modifiedHtml = html.replace('</head>', `${configScript}</head>`);

        return new Response(modifiedHtml, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      }
    } catch (error) {
      console.error('[Middleware] Failed to inject config into HTML:', error);
      // Return original response if injection fails
    }
  }

  return response;
});