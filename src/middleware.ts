import { defineMiddleware } from 'astro:middleware';
import { ensureConfigLoaded } from './services/config-loader';

// Ensure config is loaded at startup for SSR
let configLoadPromise: Promise<any> | null = null;

if (typeof window === 'undefined') {
  configLoadPromise = ensureConfigLoaded().catch(error => {
    console.error('[Middleware] Failed to load config at startup:', error);
    throw error;
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url } = context;

  // Ensure config is loaded before processing any request
  try {
    const config = await ensureConfigLoaded();

    // Make config available in Astro locals for components to access
    context.locals.config = config;
  } catch (error) {
    console.error('[Middleware] Failed to load config:', error);
    return new Response('Configuration error', { status: 500 });
  }

  // Log requests in development
  if (import.meta.env.DEV) {
    console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname}`);
  }

  // Handle authentication for protected routes
  const protectedRoutes = ['/profile'];
  const authRoutes = ['/auth/login', '/auth/register'];

  if (protectedRoutes.some(route => url.pathname.startsWith(route))) {
    // TODO: Implement server-side auth check
    // For now, let client handle authentication
    // In a real implementation, you'd check for JWT tokens here
  }

  // Redirect authenticated users away from auth pages
  if (authRoutes.some(route => url.pathname === route)) {
    // TODO: Implement server-side auth check
    // If user is already authenticated, redirect to profile
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
        const html = await response.text();
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