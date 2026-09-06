import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import {
  cookieHeaderFrom,
  createSSRGraphQLClient,
  getCurrentSeason,
  isAuthError,
  isNotFoundError,
  loggedOutAuth,
  makeSSRFetcher,
  publicAuth
} from './ssr-graphql';

/**
 * `GraphQLClient` is replaced by a recording double so that (a) nothing can
 * leave the process and (b) the options the real client would have been
 * constructed with -- crucially the `fetch` wrapper that attaches the Cookie
 * header -- can be pulled back out and exercised directly. Everything else in
 * this file is the real module.
 */
const requestMock = vi.hoisted(() => vi.fn());
const clients = vi.hoisted(() => [] as { url: string; options: any }[]);

vi.mock('graphql-request', () => ({
  GraphQLClient: class {
    url: string;
    options: any;
    request = requestMock;
    constructor(url: string, options: any) {
      this.url = url;
      this.options = options;
      clients.push(this);
    }
  }
}));

/** A structurally valid JWT carrying the given payload. */
function jwt(payload: Record<string, unknown>): string {
  return `header.${btoa(JSON.stringify(payload))}.signature`;
}

function fakeCookies(entries: { name: string; value: string }[]): Cookies {
  return { getAll: () => entries } as unknown as Cookies;
}

/** The shape graphql-request throws for a missing anime, via the federation router. */
const NOT_FOUND = {
  message: "Failed to fetch from Subgraph 'anime-api'.",
  response: {
    errors: [
      {
        message: "Failed to fetch from Subgraph 'anime-api'.",
        extensions: {
          errors: [
            {
              message: 'record not found',
              path: ['anime'],
              extensions: { code: 'DOWNSTREAM_SERVICE_ERROR' }
            }
          ],
          serviceName: 'anime-api'
        }
      }
    ],
    data: null
  }
};

describe('isNotFoundError', () => {
  it('recognises a missing record nested in subgraph extensions', () => {
    expect(isNotFoundError(NOT_FOUND)).toBe(true);
  });

  it('recognises it at the top level too', () => {
    expect(
      isNotFoundError({ response: { errors: [{ message: 'record not found' }] } })
    ).toBe(true);
  });

  it('does NOT treat a gateway failure as not-found', () => {
    // The important negative: answering 404 for a transient outage would tell Google
    // that real pages are gone.
    expect(
      isNotFoundError({
        message: 'connect ECONNREFUSED',
        response: {
          errors: [{ message: "Failed to fetch from Subgraph 'anime-api'." }]
        }
      })
    ).toBe(false);
  });

  it('does not treat auth or timeout errors as not-found', () => {
    expect(isNotFoundError({ message: 'Request timeout' })).toBe(false);
    expect(
      isNotFoundError({ response: { errors: [{ message: 'access denied' }] } })
    ).toBe(false);
  });

  it('survives malformed errors', () => {
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError({})).toBe(false);
    expect(isNotFoundError({ response: {} })).toBe(false);
    expect(isNotFoundError({ response: { errors: [{ extensions: {} }] } })).toBe(false);
  });
});


describe('cookieHeaderFrom', () => {
  it('joins every cookie SvelteKit knows about into one header', () => {
    expect(
      cookieHeaderFrom(
        fakeCookies([
          { name: 'auth_token', value: 'abc' },
          { name: 'refresh_token', value: 'def' }
        ])
      )
    ).toBe('auth_token=abc; refresh_token=def');
  });

  it('percent-encodes values so a token with separators survives the trip', () => {
    expect(cookieHeaderFrom(fakeCookies([{ name: 'session', value: 'a b;c=d' }]))).toBe(
      'session=a%20b%3Bc%3Dd'
    );
  });

  it('is null -- not an empty string -- when the request carries no cookies', () => {
    // The null is load-bearing: createSSRGraphQLClient skips the header on it,
    // and an empty `Cookie:` header is not the same request.
    expect(cookieHeaderFrom(fakeCookies([]))).toBeNull();
  });
});

describe('createSSRGraphQLClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clients.length = 0;
    requestMock.mockReset();
    fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('points the client at the configured gateway', () => {
    createSSRGraphQLClient('https://gateway.test.invalid/graphql', null);

    expect(clients).toHaveLength(1);
    expect(clients[0].url).toBe('https://gateway.test.invalid/graphql');
  });

  it('attaches the cookie header and credentials to every request it makes', async () => {
    createSSRGraphQLClient('https://gateway.test.invalid/graphql', 'auth_token=abc');

    await clients[0].options.fetch('https://gateway.test.invalid/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe('include');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Cookie: 'auth_token=abc'
    });
    expect(init.method).toBe('POST');
  });

  it('sends no Cookie header at all when there is nothing to send', async () => {
    createSSRGraphQLClient('https://gateway.test.invalid/graphql', null);

    await clients[0].options.fetch('https://gateway.test.invalid/graphql', {});

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Cookie');
  });

  it('survives an init with no headers of its own', async () => {
    createSSRGraphQLClient('https://gateway.test.invalid/graphql', 'auth_token=abc');

    await clients[0].options.fetch('https://gateway.test.invalid/graphql');

    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Cookie: 'auth_token=abc' });
  });
});

describe('isAuthError', () => {
  it.each([
    'Access denied',
    'unauthorized',
    'invalid token',
    'JWT malformed',
    'authentication required',
    'forbidden',
    'token expired'
  ])('recognises %j on the error message', (message) => {
    expect(isAuthError({ message })).toBe(true);
  });

  it('recognises it inside a GraphQL errors array', () => {
    expect(
      isAuthError({ response: { errors: [{ message: 'Access denied for field' }] } })
    ).toBe(true);
  });

  it('scans every error in the array, not just the first', () => {
    expect(
      isAuthError({
        response: { errors: [{ message: 'something else' }, { message: 'unauthorized' }] }
      })
    ).toBe(true);
  });

  it('is false for a network or timeout failure', () => {
    expect(isAuthError({ message: 'Request timeout' })).toBe(false);
    expect(isAuthError({ message: 'connect ECONNREFUSED' })).toBe(false);
  });

  it('is false for a not-found, which must stay a 404 rather than a re-login', () => {
    expect(isAuthError({ response: { errors: [{ message: 'record not found' }] } })).toBe(false);
  });

  it('survives malformed and empty errors', () => {
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError({})).toBe(false);
    expect(isAuthError({ response: { errors: [] } })).toBe(false);
    expect(isAuthError({ response: { errors: [{}] } })).toBe(false);
    expect(isAuthError({ response: { errors: 'not-an-array' } })).toBe(false);
  });
});

describe('makeSSRFetcher', () => {
  const QUERY = 'query Anime { anime { id } }';
  const HOST = 'https://gateway.test.invalid/graphql';

  beforeEach(() => {
    clients.length = 0;
    requestMock.mockReset();
  });

  it('returns the data and reports no expired token on the happy path', async () => {
    requestMock.mockResolvedValue({ anime: { id: 'a1' } });
    const fetcher = makeSSRFetcher(HOST, 'auth_token=abc');

    await expect(fetcher.fetchWithFallback(QUERY, { id: 'a1' }, 'anime')).resolves.toEqual({
      anime: { id: 'a1' }
    });
    expect(requestMock).toHaveBeenCalledWith(QUERY, { id: 'a1' });
    expect(fetcher.wasTokenExpired()).toBe(false);
    expect(clients).toHaveLength(1);
  });

  it('retries an auth failure against a cookie-less client so public data still renders', async () => {
    requestMock
      .mockRejectedValueOnce(Object.assign(new Error('Access denied'), {}))
      .mockResolvedValueOnce({ anime: { id: 'a1' } });
    const fetcher = makeSSRFetcher(HOST, 'auth_token=expired');

    await expect(fetcher.fetchWithFallback(QUERY, {}, 'anime')).resolves.toEqual({
      anime: { id: 'a1' }
    });

    // a second client was built, and it carries no cookies
    expect(clients).toHaveLength(2);
    expect(clients[1].url).toBe(HOST);
    expect(fetcher.wasTokenExpired()).toBe(true);
  });

  it('returns null when the retry fails too', async () => {
    requestMock
      .mockRejectedValueOnce(new Error('unauthorized'))
      .mockRejectedValueOnce(new Error('still broken'));
    const fetcher = makeSSRFetcher(HOST, 'auth_token=expired');

    await expect(fetcher.fetchWithFallback(QUERY, {}, 'anime')).resolves.toBeNull();
    expect(fetcher.wasTokenExpired()).toBe(true);
  });

  it('returns null without retrying for a non-auth failure', async () => {
    requestMock.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const fetcher = makeSSRFetcher(HOST, 'auth_token=abc');

    await expect(fetcher.fetchWithFallback(QUERY, {}, 'anime')).resolves.toBeNull();
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(clients).toHaveLength(1);
    expect(fetcher.wasTokenExpired()).toBe(false);
  });

  it('passes a null payload straight through rather than treating it as failure', async () => {
    // A 200 carrying `{ anime: null }` is a real answer -- "no such record" --
    // and must not be turned into the auth fallback path.
    requestMock.mockResolvedValue({ anime: null });
    const fetcher = makeSSRFetcher(HOST, null);

    await expect(fetcher.fetchWithFallback(QUERY, {}, 'anime')).resolves.toEqual({ anime: null });
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('gives up on a hung request after 10s rather than hanging the render', async () => {
    vi.useFakeTimers();
    try {
      requestMock.mockReturnValue(new Promise(() => {}));
      const fetcher = makeSSRFetcher(HOST, 'auth_token=abc');

      const pending = fetcher.fetchWithFallback(QUERY, {}, 'anime');
      await vi.advanceTimersByTimeAsync(10_000);

      // the timeout is not an auth error, so there is no public retry
      await expect(pending).resolves.toBeNull();
      expect(fetcher.wasTokenExpired()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives the public retry its own, shorter 8s budget', async () => {
    vi.useFakeTimers();
    try {
      requestMock
        .mockRejectedValueOnce(new Error('token expired'))
        .mockReturnValueOnce(new Promise(() => {}));
      const fetcher = makeSSRFetcher(HOST, 'auth_token=expired');

      const pending = fetcher.fetchWithFallback(QUERY, {}, 'anime');
      await vi.advanceTimersByTimeAsync(8_000);

      await expect(pending).resolves.toBeNull();
      expect(fetcher.wasTokenExpired()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('remembers an expired token across later successful calls', async () => {
    requestMock
      .mockRejectedValueOnce(new Error('Access denied'))
      .mockResolvedValueOnce({ a: 1 })
      .mockResolvedValueOnce({ b: 2 });
    const fetcher = makeSSRFetcher(HOST, 'auth_token=expired');

    await fetcher.fetchWithFallback(QUERY, {}, 'first');
    await fetcher.fetchWithFallback(QUERY, {}, 'second');

    expect(fetcher.wasTokenExpired()).toBe(true);
  });
});

describe('publicAuth', () => {
  const base = { isLoggedIn: true, hasAuthToken: true, hasRefreshToken: true };

  it('never leaks token material into the serialized page', () => {
    const result = publicAuth({ ...base, authToken: jwt({ exp: 1700000000, sub: 'u1' }) } as any);

    expect(Object.keys(result).sort()).toEqual([
      'authTokenExpiresAt',
      'hasAuthToken',
      'hasRefreshToken',
      'isLoggedIn'
    ]);
    expect(JSON.stringify(result)).not.toContain('header.');
  });

  it('converts the JWT exp to milliseconds for the client-side refresher', () => {
    expect(
      publicAuth({ ...base, authToken: jwt({ exp: 1700000000 }) } as any).authTokenExpiresAt
    ).toBe(1700000000000);
  });

  it('is null when there is no token', () => {
    expect(publicAuth({ ...base, authToken: undefined } as any).authTokenExpiresAt).toBeNull();
  });

  it('is null for an undecodable token rather than throwing mid-render', () => {
    expect(publicAuth({ ...base, authToken: 'not-a-jwt' } as any).authTokenExpiresAt).toBeNull();
  });

  it('is null when the payload has no numeric exp', () => {
    expect(
      publicAuth({ ...base, authToken: jwt({ sub: 'u1' }) } as any).authTokenExpiresAt
    ).toBeNull();
    expect(
      publicAuth({ ...base, authToken: jwt({ exp: 'soon' }) } as any).authTokenExpiresAt
    ).toBeNull();
  });

  it('carries the flags through unchanged', () => {
    expect(
      publicAuth({
        isLoggedIn: false,
        hasAuthToken: false,
        hasRefreshToken: true,
        authToken: undefined
      } as any)
    ).toEqual({
      isLoggedIn: false,
      hasAuthToken: false,
      hasRefreshToken: true,
      authTokenExpiresAt: null
    });
  });
});

describe('loggedOutAuth', () => {
  it('is the blanked-out shape a page returns after detecting an expired token', () => {
    expect(loggedOutAuth()).toEqual({
      isLoggedIn: false,
      hasAuthToken: false,
      hasRefreshToken: false,
      authTokenExpiresAt: null
    });
  });

  it('matches the publicAuth shape so the client reads one type either way', () => {
    const populated = publicAuth({
      isLoggedIn: true,
      hasAuthToken: true,
      hasRefreshToken: true,
      authToken: undefined
    } as any);

    expect(Object.keys(loggedOutAuth()).sort()).toEqual(Object.keys(populated).sort());
  });
});

describe('getCurrentSeason', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['2025-01-15T12:00:00Z', 'WINTER_2025'],
    ['2025-03-31T12:00:00Z', 'WINTER_2025'],
    ['2025-04-01T12:00:00Z', 'SPRING_2025'],
    ['2025-06-30T12:00:00Z', 'SPRING_2025'],
    ['2025-07-01T12:00:00Z', 'SUMMER_2025'],
    ['2025-09-30T12:00:00Z', 'SUMMER_2025'],
    ['2025-10-01T12:00:00Z', 'FALL_2025'],
    ['2025-12-31T12:00:00Z', 'FALL_2025']
  ])('maps %s to %s', (now, expected) => {
    vi.useFakeTimers();
    // noon UTC keeps the local-time month the same in any sane CI timezone
    vi.setSystemTime(new Date(now));

    expect(getCurrentSeason()).toBe(expected);
  });
});
