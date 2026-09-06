/**
 * @vitest-environment node
 *
 * The server hook: every request the SSR pods answer passes through it, and it
 * is the only place auth cookies are read, refreshed and cleared. e2e only ever
 * walks its happy path, so what is asserted here is the rest — absent and
 * malformed cookies, an expired access token, each distinct way a refresh can
 * fail, and what survives onto `locals` for the loaders downstream.
 *
 * Nothing here reaches the network: `fetch` is stubbed, so `refreshTokenSSR`
 * runs for real against a canned response. That is deliberate — the Astro-style
 * cookie shim in this file only gets exercised when a real refresh reads and
 * writes through it, and mocking the refresh away would leave the shim untested
 * along with the cookie attributes it forwards.
 *
 * Cookie names come from `$lib/server/auth-cookies`, never from literals, so a
 * rename there fails this file instead of silently passing it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { AUTH_COOKIE_NAMES, LEGACY_AUTH_COOKIE_NAMES } from '$lib/server/auth-cookies';

const { getConfig } = vi.hoisted(() => ({ getConfig: vi.fn() }));
vi.mock('./config/build-time-loader', () => ({ getConfig }));

const GRAPHQL_HOST = 'https://gql.example.test/graphql';
const CONFIG = { api_host: 'https://api.example.test', graphql_host: GRAPHQL_HOST };

// ---------------------------------------------------------------- test doubles

/** A JWT whose only meaningful claim is `exp` — all `isTokenExpired` reads. */
function jwt(expSecondsFromNow: number): string {
  const payload = { exp: Math.floor(Date.now() / 1000) + expSecondsFromNow };
  return `header.${btoa(JSON.stringify(payload))}.signature`;
}

const FRESH = jwt(3600);
const EXPIRED = jwt(-3600);

type CookieCall = { name: string; value?: string; options: Record<string, unknown> };

/**
 * SvelteKit's `Cookies`, reduced to what the hook and the refresh touch, and
 * backed by the same jar the request's `cookie` header is built from — so
 * `cookies.get()` and the header cannot disagree the way two hand-written
 * fixtures would.
 */
function makeCookies(header: string) {
  const jar = new Map<string, string>();
  for (const pair of header.split(';')) {
    const [name, ...rest] = pair.trim().split('=');
    if (name && rest.length) jar.set(name, rest.join('='));
  }

  const sets: CookieCall[] = [];
  const deletes: CookieCall[] = [];

  return {
    jar,
    sets,
    deletes,
    deletedNames: () => deletes.map((d) => d.name),
    get: (name: string) => jar.get(name),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      jar.set(name, value);
      sets.push({ name, value, options });
    },
    delete: (name: string, options: Record<string, unknown>) => {
      jar.delete(name);
      deletes.push({ name, options });
    },
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    serialize: () => ''
  };
}

/** The adapter's page-cache directive, which is chainable. */
function makePageCache() {
  const api: any = {
    ttl: vi.fn(() => api),
    swr: vi.fn(() => api),
    tag: vi.fn(() => api)
  };
  return api;
}

function makeEvent(opts: { path?: string; cookie?: string; platform?: any } = {}) {
  const { path = '/', cookie = '', platform } = opts;
  const url = new URL(`https://weeb.vip${path}`);
  const cookies = makeCookies(cookie);
  const request = new Request(url, { headers: cookie ? { cookie } : {} });

  return {
    request,
    url,
    cookies,
    locals: {} as App.Locals,
    platform
  } as any;
}

function makeResolve(response = new Response('ok', { status: 200 })) {
  return vi.fn(async () => response);
}

/** The module caches its config in a module-level binding, so each test gets a fresh copy. */
async function loadHandle() {
  vi.resetModules();
  return (await import('./hooks.server')).handle;
}

// ------------------------------------------------------------- fetch responses

function refreshOk(token: string, refreshToken?: string) {
  return new Response(
    JSON.stringify({
      data: { RefreshToken: { id: 'u1', Credentials: { token, refresh_token: refreshToken } } }
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  getConfig.mockReset();
  getConfig.mockResolvedValue(CONFIG);
  fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ------------------------------------------------------------------------ config

describe('config', () => {
  it('loads the build-time config once and hands it to loaders on locals', async () => {
    const handle = await loadHandle();

    const first = makeEvent({ path: '/about' });
    await handle({ event: first, resolve: makeResolve() } as any);
    const second = makeEvent({ path: '/airing' });
    await handle({ event: second, resolve: makeResolve() } as any);

    expect(first.locals.config).toEqual(CONFIG);
    expect(second.locals.config).toEqual(CONFIG);
    // Cached across requests: a per-request import would be a per-request disk read.
    expect(getConfig).toHaveBeenCalledTimes(1);
  });

  it('answers 500 without rendering when the config cannot be loaded', async () => {
    getConfig.mockRejectedValue(new Error('no config bundled'));
    const handle = await loadHandle();
    const resolve = makeResolve();

    const response = await handle({ event: makeEvent({ path: '/about' }), resolve } as any);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Configuration error');
    expect(resolve).not.toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------- static assets

describe('static assets', () => {
  it.each(['/assets/logo.png', '/_app/immutable/entry/app.js', '/favicon.ico', '/manifest.json'])(
    'passes %s straight through without touching auth',
    async (path) => {
      const handle = await loadHandle();
      const event = makeEvent({ path, cookie: `auth_token=${FRESH}` });
      const resolve = makeResolve();

      await handle({ event, resolve } as any);

      expect(resolve).toHaveBeenCalledOnce();
      expect(event.locals.auth).toBeUndefined();
      expect(getConfig).not.toHaveBeenCalled();
    }
  );

  it('still resolves a page whose path merely contains an asset-like segment', async () => {
    const handle = await loadHandle();
    const event = makeEvent({ path: '/show/png-anime' });

    await handle({ event, resolve: makeResolve() } as any);

    expect(event.locals.auth).toBeDefined();
  });
});

// -------------------------------------------------------------- reading cookies

describe('reading auth cookies', () => {
  it('reports an anonymous visitor when there are no cookies at all', async () => {
    const handle = await loadHandle();
    const event = makeEvent({ path: '/' });

    await handle({ event, resolve: makeResolve() } as any);

    expect(event.locals.auth).toEqual({
      isLoggedIn: false,
      authToken: undefined,
      refreshToken: undefined,
      hasAuthToken: false,
      hasRefreshToken: false
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads a live session from auth_token', async () => {
    const handle = await loadHandle();
    const event = makeEvent({ path: '/', cookie: `auth_token=${FRESH}; refresh_token=r1` });

    await handle({ event, resolve: makeResolve() } as any);

    expect(event.locals.auth).toEqual({
      isLoggedIn: true,
      authToken: FRESH,
      refreshToken: 'r1',
      hasAuthToken: true,
      hasRefreshToken: true
    });
    // A live access token must not trigger a refresh round-trip.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to access_token when auth_token is absent', async () => {
    const handle = await loadHandle();
    const event = makeEvent({ path: '/', cookie: `access_token=${FRESH}` });

    await handle({ event, resolve: makeResolve() } as any);

    expect(event.locals.auth.authToken).toBe(FRESH);
    expect(event.locals.auth.isLoggedIn).toBe(true);
  });

  it('decodes a percent-encoded cookie value', async () => {
    const handle = await loadHandle();
    const event = makeEvent({ path: '/', cookie: 'refresh_token=a%2Fb%3Dc' });

    await handle({ event, resolve: makeResolve() } as any);

    expect(event.locals.auth.refreshToken).toBe('a/b=c');
  });

  it.each([
    ['a bare word', 'garbage'],
    ['a name with no value', 'auth_token'],
    ['an unrelated cookie', 'theme=dark; consent=1'],
    ['an empty header', '']
  ])('treats %s as no session', async (_label, cookie) => {
    const handle = await loadHandle();
    const event = makeEvent({ path: '/', cookie });

    await handle({ event, resolve: makeResolve() } as any);

    expect(event.locals.auth.isLoggedIn).toBe(false);
    expect(event.locals.auth.hasAuthToken).toBe(false);
  });

  it('logs a visitor out when the access token is expired and nothing can refresh it', async () => {
    const handle = await loadHandle();
    const event = makeEvent({ path: '/', cookie: `auth_token=${EXPIRED}` });

    await handle({ event, resolve: makeResolve() } as any);

    expect(event.locals.auth.isLoggedIn).toBe(false);
    // The token is still reported so a loader can tell "expired" from "never had one".
    expect(event.locals.auth.hasAuthToken).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs a visitor out when the access token is not a JWT at all', async () => {
    const handle = await loadHandle();
    const event = makeEvent({ path: '/', cookie: 'auth_token=not-a-jwt' });

    await handle({ event, resolve: makeResolve() } as any);

    // isTokenExpired fails closed on an unparseable token.
    expect(event.locals.auth.isLoggedIn).toBe(false);
  });
});

// ------------------------------------------------------------------- refreshing

describe('server-side token refresh', () => {
  it('refreshes when there is a refresh token and no access token', async () => {
    fetchMock.mockResolvedValue(refreshOk('new-access', 'new-refresh'));
    const handle = await loadHandle();
    const event = makeEvent({ path: '/', cookie: 'refresh_token=r1' });

    await handle({ event, resolve: makeResolve() } as any);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(GRAPHQL_HOST);
    expect(JSON.parse(String(init.body)).variables).toEqual({ token: 'r1' });

    expect(event.locals.auth.isLoggedIn).toBe(true);
    expect(event.locals.auth.authToken).toBe('new-access');
    expect(event.locals.auth.refreshToken).toBe('new-refresh');
  });

  it('refreshes when the access token is present but expired', async () => {
    fetchMock.mockResolvedValue(refreshOk('new-access', 'new-refresh'));
    const handle = await loadHandle();
    const event = makeEvent({ path: '/', cookie: `auth_token=${EXPIRED}; refresh_token=r1` });

    await handle({ event, resolve: makeResolve() } as any);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(event.locals.auth.authToken).toBe('new-access');
  });

  it('writes the refreshed tokens back through the cookie shim, path-scoped to the site', async () => {
    fetchMock.mockResolvedValue(refreshOk('new-access', 'new-refresh'));
    const handle = await loadHandle();
    const event = makeEvent({ path: '/', cookie: 'refresh_token=r1' });

    await handle({ event, resolve: makeResolve() } as any);

    const byName = new Map<string, CookieCall>(
      event.cookies.sets.map((c: CookieCall) => [c.name, c] as [string, CookieCall])
    );
    expect([...byName.keys()].sort()).toEqual(['access_token', 'auth_token', 'refresh_token']);
    for (const call of event.cookies.sets) {
      // The shim's whole job: SvelteKit rejects a set() with no path.
      expect(call.options.path).toBe('/');
      expect(call.options.httpOnly).toBe(true);
      expect(call.options.sameSite).toBe('lax');
    }
    expect(byName.get('auth_token')!.value).toBe('new-access');
    expect(byName.get('refresh_token')!.value).toBe('new-refresh');
  });

  it('keeps the existing refresh token when the server does not rotate it', async () => {
    fetchMock.mockResolvedValue(refreshOk('new-access', undefined));
    const handle = await loadHandle();
    const event = makeEvent({ path: '/', cookie: 'refresh_token=r1' });

    await handle({ event, resolve: makeResolve() } as any);

    expect(event.locals.auth.isLoggedIn).toBe(true);
    expect(event.locals.auth.refreshToken).toBe('r1');
    expect(event.cookies.sets.some((c: CookieCall) => c.name === 'refresh_token')).toBe(false);
  });

  it('falls back to localhost when the config carries no graphql_host', async () => {
    getConfig.mockResolvedValue({ api_host: 'https://api.example.test' });
    fetchMock.mockResolvedValue(refreshOk('new-access'));
    const handle = await loadHandle();

    await handle({
      event: makeEvent({ path: '/', cookie: 'refresh_token=r1' }),
      resolve: makeResolve()
    } as any);

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8079');
  });

  describe('when the refresh fails', () => {
    const clearedEverything = (event: any) => {
      const deleted = new Set(event.cookies.deletedNames());
      for (const name of [...AUTH_COOKIE_NAMES, ...LEGACY_AUTH_COOKIE_NAMES]) {
        expect(deleted).toContain(name);
      }
      for (const call of event.cookies.deletes) {
        expect(call.options.path).toBe('/');
      }
    };

    it('clears every auth cookie when the refresh token is rejected (401)', async () => {
      fetchMock.mockResolvedValue(new Response('nope', { status: 401 }));
      const handle = await loadHandle();
      const event = makeEvent({ path: '/', cookie: 'refresh_token=revoked' });

      await handle({ event, resolve: makeResolve() } as any);

      expect(event.locals.auth.isLoggedIn).toBe(false);
      clearedEverything(event);
    });

    it('clears them on a 403 too', async () => {
      fetchMock.mockResolvedValue(new Response('nope', { status: 403 }));
      const handle = await loadHandle();
      const event = makeEvent({ path: '/', cookie: 'refresh_token=revoked' });

      await handle({ event, resolve: makeResolve() } as any);

      clearedEverything(event);
    });

    it('clears them when the mutation comes back with GraphQL errors', async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ errors: [{ message: 'token revoked' }] }), { status: 200 })
      );
      const handle = await loadHandle();
      const event = makeEvent({ path: '/', cookie: 'refresh_token=revoked' });

      await handle({ event, resolve: makeResolve() } as any);

      expect(event.locals.auth.isLoggedIn).toBe(false);
      clearedEverything(event);
    });

    it('keeps the cookies on a transient 5xx so the session survives an outage', async () => {
      fetchMock.mockResolvedValue(new Response('bad gateway', { status: 502 }));
      const handle = await loadHandle();
      const event = makeEvent({ path: '/', cookie: 'refresh_token=r1' });

      await handle({ event, resolve: makeResolve() } as any);

      expect(event.locals.auth.isLoggedIn).toBe(false);
      expect(event.cookies.deletes).toEqual([]);
      expect(event.cookies.jar.get('refresh_token')).toBe('r1');
    });

    it('keeps the cookies when the request throws (network down)', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
      const handle = await loadHandle();
      const event = makeEvent({ path: '/', cookie: 'refresh_token=r1' });

      await handle({ event, resolve: makeResolve() } as any);

      expect(event.locals.auth.isLoggedIn).toBe(false);
      expect(event.cookies.deletes).toEqual([]);
    });

    it('keeps the cookies when a 200 comes back with no token in it', async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ data: { RefreshToken: { id: 'u1', Credentials: {} } } }), {
          status: 200
        })
      );
      const handle = await loadHandle();
      const event = makeEvent({ path: '/', cookie: 'refresh_token=r1' });

      await handle({ event, resolve: makeResolve() } as any);

      expect(event.locals.auth.isLoggedIn).toBe(false);
      expect(event.cookies.deletes).toEqual([]);
    });

    it('still renders the page — a failed refresh is a logged-out visitor, not an error', async () => {
      fetchMock.mockResolvedValue(new Response('nope', { status: 401 }));
      const handle = await loadHandle();
      const resolve = makeResolve();

      const response = await handle({
        event: makeEvent({ path: '/', cookie: 'refresh_token=revoked' }),
        resolve
      } as any);

      expect(resolve).toHaveBeenCalledOnce();
      expect(response.status).toBe(200);
    });

    /**
     * REGRESSION GUARD. `AuthStorage.getTokensFromCookieString` accepts the
     * legacy `refreshToken` cookie name as a refresh token, so the hook decides
     * a refresh is due; `refreshTokenSSR` used to read `refresh_token` alone and
     * so bailed out before making a request. No request, no error, nothing
     * cleared — a visitor still holding the legacy cookie was reported logged
     * out on every request and could never self-heal. Both readers now take
     * their names from `$lib/utils/auth-cookie-names`, so they cannot drift
     * apart again.
     */
    it('refreshes off the legacy refreshToken cookie and rewrites the canonical names', async () => {
      fetchMock.mockResolvedValue(refreshOk('new-access', 'new-refresh'));
      const handle = await loadHandle();
      const event = makeEvent({ path: '/', cookie: 'refreshToken=legacy-value' });

      await handle({ event, resolve: makeResolve() } as any);

      expect(fetchMock).toHaveBeenCalledOnce();
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(String(init.body)).variables).toEqual({ token: 'legacy-value' });

      expect(event.locals.auth.isLoggedIn).toBe(true);
      expect(event.locals.auth.authToken).toBe('new-access');

      // The self-heal: the visitor leaves this request holding the names the
      // app writes today, so the legacy path is walked once and not again.
      const written = new Set(event.cookies.sets.map((c: CookieCall) => c.name));
      for (const name of AUTH_COOKIE_NAMES) {
        expect(written).toContain(name);
      }
    });

    it('prefers the canonical refresh cookie over the legacy one', async () => {
      fetchMock.mockResolvedValue(refreshOk('new-access'));
      const handle = await loadHandle();
      const event = makeEvent({
        path: '/',
        cookie: 'refresh_token=canonical; refreshToken=legacy-value'
      });

      await handle({ event, resolve: makeResolve() } as any);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(String(init.body)).variables).toEqual({ token: 'canonical' });
    });

    it('clears everything when the legacy cookie’s refresh token is rejected', async () => {
      fetchMock.mockResolvedValue(new Response('nope', { status: 401 }));
      const handle = await loadHandle();
      const event = makeEvent({ path: '/', cookie: 'refreshToken=revoked-legacy' });

      await handle({ event, resolve: makeResolve() } as any);

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(event.locals.auth.isLoggedIn).toBe(false);
      clearedEverything(event);
    });

    /**
     * REGRESSION GUARD. `hasRefreshToken`/`refreshToken` used to be derived from
     * the pre-refresh cookie read and never reset, so once `clearAuthCookies`
     * had run on a failed refresh, `locals.auth` still advertised the token that
     * had just been deleted and a downstream loader would act on a credential
     * the browser was being told to drop.
     */
    it('forgets the cleared tokens on locals instead of advertising them', async () => {
      fetchMock.mockResolvedValue(new Response('nope', { status: 401 }));
      const handle = await loadHandle();
      const event = makeEvent({
        path: '/',
        cookie: `auth_token=${EXPIRED}; refresh_token=revoked`
      });

      await handle({ event, resolve: makeResolve() } as any);

      expect(event.cookies.jar.has('refresh_token')).toBe(false);
      expect(event.locals.auth).toEqual({
        isLoggedIn: false,
        authToken: undefined,
        refreshToken: undefined,
        hasAuthToken: false,
        hasRefreshToken: false
      });
    });

    it('still reports the tokens a transient failure left in place', async () => {
      // The other side of the same rule: nothing was deleted, so nothing is
      // forgotten — a loader can still tell "outage" from "signed out".
      fetchMock.mockResolvedValue(new Response('bad gateway', { status: 502 }));
      const handle = await loadHandle();
      const event = makeEvent({ path: '/', cookie: 'refresh_token=r1' });

      await handle({ event, resolve: makeResolve() } as any);

      expect(event.locals.auth.hasRefreshToken).toBe(true);
      expect(event.locals.auth.refreshToken).toBe('r1');
    });
  });
});

// -------------------------------------------------------------------- redirects

describe('route guards', () => {
  const expectRedirect = async (result: unknown, location: string) => {
    const error = await Promise.resolve(result).then(
      () => null,
      (e: unknown) => e
    );
    expect(error, 'expected the hook to redirect').not.toBeNull();
    expect(isRedirect(error)).toBe(true);
    expect((error as any).status).toBe(302);
    expect((error as any).location).toBe(location);
  };

  it('sends an anonymous visitor from /profile to the login page', async () => {
    const handle = await loadHandle();
    const resolve = makeResolve();

    await expectRedirect(
      handle({ event: makeEvent({ path: '/profile' }), resolve } as any),
      '/auth/login'
    );
    expect(resolve).not.toHaveBeenCalled();
  });

  it('guards everything under /profile, not just the index', async () => {
    const handle = await loadHandle();

    await expectRedirect(
      handle({ event: makeEvent({ path: '/profile/settings' }), resolve: makeResolve() } as any),
      '/auth/login'
    );
  });

  /**
   * REGRESSION GUARD. The guard used to be a prefix match on the bare string
   * rather than a segment match, so it captured any route whose path merely
   * started with "/profile" — `/profiles`, `/profile-settings`, a public
   * `/profile-of/:user`. Locking a page down by accident is the safe direction
   * to fail, which is exactly why nobody would have noticed: the first public
   * route under that prefix would silently have become login-only.
   */
  it.each(['/profiles', '/profile-settings', '/profile-of/someone'])(
    'does not guard %s, which merely shares the /profile prefix',
    async (path) => {
      const handle = await loadHandle();
      const resolve = makeResolve();

      await handle({ event: makeEvent({ path }), resolve } as any);

      expect(resolve).toHaveBeenCalledOnce();
    }
  );

  it('still guards the segment boundary itself', async () => {
    const handle = await loadHandle();

    await expectRedirect(
      handle({ event: makeEvent({ path: '/profile/anime/watching' }), resolve: makeResolve() } as any),
      '/auth/login'
    );
  });

  it('sends a visitor whose refresh was rejected to the login page', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 401 }));
    const handle = await loadHandle();

    await expectRedirect(
      handle({
        event: makeEvent({ path: '/profile', cookie: 'refresh_token=revoked' }),
        resolve: makeResolve()
      } as any),
      '/auth/login'
    );
  });

  it('lets a signed-in visitor through to /profile', async () => {
    const handle = await loadHandle();
    const resolve = makeResolve();

    await handle({
      event: makeEvent({ path: '/profile', cookie: `auth_token=${FRESH}` }),
      resolve
    } as any);

    expect(resolve).toHaveBeenCalledOnce();
  });

  it('lets a visitor refreshed on this very request through to /profile', async () => {
    fetchMock.mockResolvedValue(refreshOk('new-access', 'new-refresh'));
    const handle = await loadHandle();
    const resolve = makeResolve();

    await handle({
      event: makeEvent({ path: '/profile', cookie: 'refresh_token=r1' }),
      resolve
    } as any);

    expect(resolve).toHaveBeenCalledOnce();
  });

  it.each(['/auth/login', '/auth/register'])(
    'bounces a signed-in visitor off %s to their profile',
    async (path) => {
      const handle = await loadHandle();

      await expectRedirect(
        handle({
          event: makeEvent({ path, cookie: `auth_token=${FRESH}` }),
          resolve: makeResolve()
        } as any),
        '/profile'
      );
    }
  );

  it('leaves the login page alone for an anonymous visitor', async () => {
    const handle = await loadHandle();
    const resolve = makeResolve();

    await handle({ event: makeEvent({ path: '/auth/login' }), resolve } as any);

    expect(resolve).toHaveBeenCalledOnce();
  });

  it('does not bounce a signed-in visitor off the other auth pages', async () => {
    const handle = await loadHandle();
    const resolve = makeResolve();

    // Only /auth/login and /auth/register are matched, and by exact pathname —
    // password reset and verification must stay reachable while signed in.
    await handle({
      event: makeEvent({ path: '/auth/password-reset', cookie: `auth_token=${FRESH}` }),
      resolve
    } as any);

    expect(resolve).toHaveBeenCalledOnce();
  });
});

// ----------------------------------------------------------- headers and caching

describe('response headers', () => {
  it('sets the security headers on every rendered page', async () => {
    const handle = await loadHandle();

    const response = await handle({ event: makeEvent({ path: '/' }), resolve: makeResolve() } as any);

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Content-Security-Policy')).toBe(
      "frame-ancestors 'self' https://jamesat.dev"
    );
    expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    // X-Frame-Options is deliberately gone: CSP frame-ancestors overrides it.
    expect(response.headers.has('X-Frame-Options')).toBe(false);
  });

  it('emits no cache policy at all without the adapter (the Cloudflare build)', async () => {
    const handle = await loadHandle();

    const response = await handle({ event: makeEvent({ path: '/' }), resolve: makeResolve() } as any);

    expect(response.headers.has('Cache-Control')).toBe(false);
  });
});

describe('page cache', () => {
  it('declares ttl, swr and tags for a cacheable route', async () => {
    const cache = makePageCache();
    const handle = await loadHandle();

    await handle({
      event: makeEvent({ path: '/', platform: { cache } }),
      resolve: makeResolve()
    } as any);

    expect(cache.ttl).toHaveBeenCalledWith(12 * 3600);
    expect(cache.swr).toHaveBeenCalledWith(24 * 3600);
    expect(cache.tag).toHaveBeenCalledWith(['home']);
  });

  it.each([
    ['/airing', ['airing']],
    ['/airing/calendar', ['airing']],
    ['/season/fall-2024', ['season:fall-2024']],
    ['/show/abc123', ['show:abc123']],
    ['/show/abc123/news', ['show:abc123', 'news']]
  ])('tags %s with %j so an ingest can purge it', async (path, tags) => {
    const cache = makePageCache();
    const handle = await loadHandle();

    await handle({ event: makeEvent({ path, platform: { cache } }), resolve: makeResolve() } as any);

    expect(cache.tag).toHaveBeenCalledWith(tags);
  });

  it('leaves an unlisted route uncached', async () => {
    const cache = makePageCache();
    const handle = await loadHandle();

    const response = await handle({
      event: makeEvent({ path: '/about', platform: { cache } }),
      resolve: makeResolve()
    } as any);

    expect(cache.ttl).not.toHaveBeenCalled();
    expect(response.headers.has('Cache-Control')).toBe(false);
  });

  it('publicly caches an anonymous render of a cacheable page', async () => {
    const handle = await loadHandle();

    const response = await handle({
      event: makeEvent({ path: '/', platform: { cache: makePageCache() } }),
      resolve: makeResolve()
    } as any);

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300, s-maxage=3600');
  });

  it('uses the route’s own numbers, not the home page’s', async () => {
    const handle = await loadHandle();

    const response = await handle({
      event: makeEvent({ path: '/show/abc123', platform: { cache: makePageCache() } }),
      resolve: makeResolve()
    } as any);

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60, s-maxage=600');
  });

  it('never lets a signed-in render into a shared cache', async () => {
    const handle = await loadHandle();

    const response = await handle({
      event: makeEvent({
        path: '/',
        cookie: `auth_token=${FRESH}`,
        platform: { cache: makePageCache() }
      }),
      resolve: makeResolve()
    } as any);

    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('treats a visitor holding only an expired token as non-anonymous', async () => {
    const handle = await loadHandle();

    const response = await handle({
      event: makeEvent({
        path: '/',
        cookie: `auth_token=${EXPIRED}`,
        platform: { cache: makePageCache() }
      }),
      resolve: makeResolve()
    } as any);

    // Logged out, but the cookie is still on the request, so the render may
    // still differ — it must not be published to the shared cache.
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('publicly caches a request whose auth cookies were just cleared', async () => {
    // Once the refresh is rejected and `clearAuthCookies` has run, this render
    // *is* the anonymous one — there is no session left to personalize it. It
    // used to be judged by the cookies the request arrived with and handed
    // `private, no-store`, throwing away a hit it was entitled to.
    fetchMock.mockResolvedValue(new Response('nope', { status: 401 }));
    const handle = await loadHandle();

    const response = await handle({
      event: makeEvent({
        path: '/',
        cookie: 'refresh_token=revoked',
        platform: { cache: makePageCache() }
      }),
      resolve: makeResolve()
    } as any);

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=300, s-maxage=3600');
  });

  it('keeps a request out of the shared cache while its cookies survive', async () => {
    // The counterpart: a transient failure leaves the cookies alone, so the
    // visitor may still be signed in on the next request and this render must
    // not be published.
    fetchMock.mockResolvedValue(new Response('bad gateway', { status: 502 }));
    const handle = await loadHandle();

    const response = await handle({
      event: makeEvent({
        path: '/',
        cookie: 'refresh_token=r1',
        platform: { cache: makePageCache() }
      }),
      resolve: makeResolve()
    } as any);

    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('does not cache a non-200, so a soft 404 cannot be published', async () => {
    const handle = await loadHandle();

    const response = await handle({
      event: makeEvent({ path: '/show/missing', platform: { cache: makePageCache() } }),
      resolve: makeResolve(new Response('gone', { status: 404 }))
    } as any);

    expect(response.headers.has('Cache-Control')).toBe(false);
    // The security headers still apply to the 404.
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
