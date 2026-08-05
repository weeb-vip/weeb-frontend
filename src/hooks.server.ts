import { redirect, type Handle } from '@sveltejs/kit';
import { getConfig } from './config/build-time-loader';
import { AuthStorage } from './utils/auth-storage';
import { refreshTokenSSR, isTokenExpired } from './utils/ssr-token-refresh';
import { clearAuthCookies } from '$lib/server/auth-cookies';

// Config cache for performance
let configData: any = null;

/**
 * Which pages may be cached, in one table rather than scattered across load
 * functions. Nothing is cached unless it matches here: the adapter's default
 * TTL is 0, so a new route stays uncached until it is added deliberately.
 *
 * Note what is deliberately NOT called here: `.public()`. That declares a page
 * identical for every visitor, which puts it in the `pub` segment — and `pub`
 * is served to logged-in users too. Every page below renders watchlist state
 * when there is a session, so the claim would be false and a logged-in visitor
 * would be handed the anonymous render, seeing "not on list" on everything.
 * That is the bug the cookie-forwarding comment in show/[id]/+page.server.ts
 * describes fixing, and it would come straight back.
 *
 * Without `.public()` these land in `anon`: cached from a logged-out render,
 * served only to logged-out visitors, and unreadable by an authenticated
 * request. Logged-in traffic bypasses the cache entirely and is rendered fresh.
 *
 * To get cache hits for logged-in users too, the page has to stop rendering
 * per-user data into its HTML and fetch it after hydration — then, and only
 * then, `.public()` becomes true.
 *
 * ttl/swr drive the adapter's Redis cache, which is what the Knative edge tier
 * serves from. maxAge/sMaxAge drive the response header, which is what the
 * browser and — on the Cloudflare build, where the adapter does not exist —
 * Cloudflare's CDN honour. They are deliberately separate: the two shared
 * caches were tuned independently, and the sMaxAge values here preserve what
 * production was already doing rather than quietly retuning it.
 *
 * On picking a ttl: freshness comes from purging by tag, not from expiry. An
 * entry is Fresh for ttl and Stale for the swr window after it, and a stale
 * serve is fast for the visitor but wakes an SSR pod to revalidate behind it.
 * Staging's first day ran ttl=60 and measured 5 hits against 5 stales — every
 * repeat visit landed after the fresh window had closed, so the pod was woken
 * about as often as with no cache at all and never scaled to zero. A ttl below
 * the real gap between two visits to the same URL buys latency and throws away
 * the scale-to-zero the architecture exists for. Prefer a generous ttl and
 * purge on ingest.
 */
const CACHEABLE_ROUTES: Array<{
  pattern: RegExp;
  ttl: number;
  swr: number;
  maxAge: number;
  sMaxAge: number;
  tags: (match: RegExpExecArray) => string[];
}> = [
  // The two genuinely time-sensitive pages: an episode airing changes what they
  // show. Still five minutes rather than one — nothing here is live to the
  // second, and the airing sync can purge `airing` when it ingests.
  { pattern: /^\/$/,                    ttl: 300,  swr: 3600, maxAge: 300, sMaxAge: 3600, tags: () => ['home'] },
  { pattern: /^\/airing$/,              ttl: 300,  swr: 3600, maxAge: 300, sMaxAge: 3600, tags: () => ['airing'] },

  // A month grid barely moves within a month.
  { pattern: /^\/airing\/calendar$/,    ttl: 1800, swr: 7200, maxAge: 300, sMaxAge: 1800, tags: () => ['airing'] },

  // Past seasons are effectively immutable; the current one changes about as
  // fast as the airing list, which its own tag can purge.
  { pattern: /^\/season\/([^/]+)$/,     ttl: 3600, swr: 7200, maxAge: 300, sMaxAge: 1800, tags: (m) => [`season:${m[1]}`] },

  // A show's synopsis, studio and episode count are close to static — this was
  // the worst offender at ttl=60, and it is also the largest URL space (~32k),
  // so it is where repeat visits are furthest apart. Purged by `show:<id>`.
  { pattern: /^\/show\/([^/]+)$/,       ttl: 3600, swr: 7200, maxAge: 60,  sMaxAge: 600,  tags: (m) => [`show:${m[1]}`] },

  // News arrives in batches from the ingest, which can purge `news`.
  { pattern: /^\/show\/([^/]+)\/news$/, ttl: 1800, swr: 7200, maxAge: 300, sMaxAge: 1800, tags: (m) => [`show:${m[1]}`, 'news'] }
];

function cachePolicyFor(pathname: string) {
  for (const route of CACHEABLE_ROUTES) {
    const match = route.pattern.exec(pathname);
    if (match) return { ...route, tags: route.tags(match) };
  }
  return null;
}

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

  const cachePolicy = cachePolicyFor(url.pathname);

  // Declared before the render, but the adapter reads the directive back only
  // after the whole response is produced — so this is equivalent to calling it
  // inside a load, and keeps every route's policy in the table above.
  // platform.cache is absent on the Cloudflare build, where the optional
  // chaining makes this inert rather than broken.
  if (cachePolicy) {
    event.platform?.cache
      ?.ttl(cachePolicy.ttl)
      .swr(cachePolicy.swr)
      .tag(cachePolicy.tags);
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
    //
    // Restricted to 200s to match what the adapter will store. Without that a
    // /show/<id> 404 or a /season/<bad> redirect would be handed a public
    // max-age, and this codebase has already had to dig itself out of soft-404s
    // being indexed.
    const isAnonymous = !authResult.isLoggedIn && !hasRefreshToken && !hasAccessToken;
    if (cachePolicy && response.status === 200) {
      response.headers.set(
        'Cache-Control',
        isAnonymous
          ? `public, max-age=${cachePolicy.maxAge}, s-maxage=${cachePolicy.sMaxAge}`
          : 'private, no-store'
      );
    }
  }

  return response;
};
