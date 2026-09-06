import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as queryOptions from './query-options';

/**
 * `query-options.ts` is the SSR-safe half of the data layer: plain
 * `{ queryKey, queryFn }` / `{ mutationFn }` factories over the GraphQL
 * documents, plus the auth-retry plumbing they share. No runes, no
 * `createQuery` -- which is exactly why it can be tested as pure contract.
 *
 * What is stubbed, and why:
 *   - `fetch` is a `vi.fn()`. Every request goes through it (graphql-request is
 *     constructed with a custom `fetch` that delegates to the global), so
 *     nothing can leave the process, and the outgoing body is inspectable.
 *   - `./config-loader` returns a fixed host instead of reading /config.json.
 *   - `$lib/utils/auth-storage` is the cookie/localStorage boundary.
 *   - `$lib/utils/debug` is noise.
 *
 * graphql-request itself is real: the request body, the error shape it throws
 * and the data unwrapping are the contract under test, so faking it would test
 * nothing.
 *
 * Two things are deliberately asserted about every key factory: its exact
 * shape, and that two calls with the same arguments produce a structurally
 * equal key. TanStack hashes keys structurally, so a key that varies per call
 * (a fresh `new Date()`, say) silently disables caching.
 */

const HOST = 'https://gateway.test.invalid/graphql';

const mockDebug = vi.hoisted(() => ({
  auth: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  anime: vi.fn()
}));

const mockAuthStorage = vi.hoisted(() => ({
  getAuthToken: vi.fn<() => string | null>(() => null),
  getRefreshToken: vi.fn<() => string | null>(() => null),
  clearTokens: vi.fn(),
  setRefreshTokenLocalStorage: vi.fn(),
  setTokensForLocalhost: vi.fn(),
  getTokenFromCookieString: vi.fn<(c?: string) => string | undefined>(() => undefined),
  getTokensFromCookieString: vi.fn<
    (c?: string) => { authToken?: string; refreshToken?: string }
  >(() => ({}))
}));

vi.mock('$lib/utils/debug', () => ({ __esModule: true, default: mockDebug }));
vi.mock('$lib/utils/auth-storage', () => ({ AuthStorage: mockAuthStorage }));
vi.mock('./config-loader', () => ({
  ensureConfigLoaded: vi.fn(async () => ({ graphql_host: HOST })),
  getConfigSync: vi.fn(() => ({ graphql_host: HOST })),
  isConfigLoaded: vi.fn(() => true)
}));

let fetchMock: ReturnType<typeof vi.fn>;

/** A 200 carrying a GraphQL data payload. */
function gqlOk(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

/** A 200 carrying GraphQL errors -- how the gateway reports auth failures. */
function gqlErrors(errors: { message: string }[], data: unknown = null) {
  return new Response(JSON.stringify({ data, errors }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

/** A transport-level failure. */
function httpStatus(status: number, body = '') {
  return new Response(body, { status, headers: { 'content-type': 'text/plain' } });
}

/** The JSON body of the nth outgoing request. */
function sentBody(index = 0) {
  return JSON.parse(fetchMock.mock.calls[index][1].body);
}

function sentInit(index = 0) {
  return fetchMock.mock.calls[index][1];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthStorage.getRefreshToken.mockReturnValue(null);
  mockAuthStorage.getAuthToken.mockReturnValue(null);
  mockAuthStorage.getTokenFromCookieString.mockReturnValue(undefined);
  mockAuthStorage.getTokensFromCookieString.mockReturnValue({});
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

describe('query keys', () => {
  const FIXED_START = new Date('2025-01-01T00:00:00.000Z');
  const FIXED_END = new Date('2025-01-08T00:00:00.000Z');

  const cases: [string, () => { queryKey: unknown[] }, unknown[]][] = [
    ['fetchHomePageData', () => queryOptions.fetchHomePageData(), ['homedata', { limit: 20 }]],
    [
      'fetchSeasonalAnime',
      () => queryOptions.fetchSeasonalAnime('WINTER_2025', 12),
      ['seasonal-anime', { season: 'WINTER_2025', limit: 12 }]
    ],
    ['fetchDetails', () => queryOptions.fetchDetails('anime-1'), ['anime-details', 'anime-1']],
    [
      'fetchCurrentlyAiring',
      () => queryOptions.fetchCurrentlyAiring(30),
      ['currently-airing', { limit: 30 }]
    ],
    [
      'fetchCurrentlyAiringWithDates',
      () => queryOptions.fetchCurrentlyAiringWithDates(FIXED_START, FIXED_END, undefined, 25),
      [
        'currentlyAiring',
        {
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2025-01-08T00:00:00.000Z',
          days: undefined,
          limit: 25
        }
      ]
    ],
    [
      'fetchCurrentlyAiringWithDatesAndEpisodes',
      () => queryOptions.fetchCurrentlyAiringWithDatesAndEpisodes(FIXED_START, null, 7, 25),
      [
        'currentlyAiringWithEpisodes',
        { startDate: '2025-01-01T00:00:00.000Z', endDate: undefined, days: 7, limit: 25 }
      ]
    ],
    ['getUser', () => queryOptions.getUser(), ['user']],
    [
      'fetchUserAnimeCount',
      () => queryOptions.fetchUserAnimeCount({ status: 'WATCHING' } as never),
      ['user-anime-count', { status: 'WATCHING' }]
    ],
    [
      'fetchUserAnimes',
      () => queryOptions.fetchUserAnimes({ status: 'WATCHING' } as never),
      ['user-animes', { status: 'WATCHING' }]
    ],
    [
      'fetchUserWorks',
      () => queryOptions.fetchUserWorks({ status: 'READING' } as never),
      ['user-works', { status: 'READING' }]
    ],
    [
      'fetchUserAnimeStatusCounts',
      () => queryOptions.fetchUserAnimeStatusCounts(),
      ['user-anime-status-counts']
    ],
    [
      'fetchUserWorkStatusCounts',
      () => queryOptions.fetchUserWorkStatusCounts(),
      ['user-work-status-counts']
    ],
    [
      'watchedEpisodes',
      () => queryOptions.watchedEpisodes('anime-1'),
      ['watched-episodes', 'anime-1']
    ],
    ['readChapters', () => queryOptions.readChapters('work-1'), ['read-chapters', 'work-1']],
    [
      'getCharactersAndStaffByAnimeID',
      () => queryOptions.getCharactersAndStaffByAnimeID('anime-1'),
      ['charactersAndStaff', 'anime-1']
    ]
  ];

  it.each(cases)('%s produces the documented key', (_name, factory, expected) => {
    expect(factory().queryKey).toEqual(expected);
  });

  it.each(cases)('%s produces a stable key across calls', (_name, factory) => {
    // Structural equality is what TanStack hashes on; a key that differs here
    // would make every mount a cache miss.
    expect(factory().queryKey).toEqual(factory().queryKey);
  });

  it('varies the key by argument, so two shows do not share a cache entry', () => {
    expect(queryOptions.fetchDetails('a').queryKey).not.toEqual(
      queryOptions.fetchDetails('b').queryKey
    );
    expect(queryOptions.fetchSeasonalAnime('WINTER_2025').queryKey).not.toEqual(
      queryOptions.fetchSeasonalAnime('SPRING_2025').queryKey
    );
  });

  it('keeps an omitted limit in the key as undefined rather than dropping it', () => {
    expect(queryOptions.fetchCurrentlyAiring().queryKey).toEqual([
      'currently-airing',
      { limit: undefined }
    ]);
    expect(queryOptions.fetchSeasonalAnime('WINTER_2025').queryKey).toEqual([
      'seasonal-anime',
      { season: 'WINTER_2025', limit: undefined }
    ]);
  });

  it('does not put the wall clock in the currently-airing key', () => {
    // fetchCurrentlyAiring derives its date window inside the queryFn on
    // purpose: putting `new Date()` in the key would make it unique per call.
    const key = queryOptions.fetchCurrentlyAiring(25).queryKey;
    expect(JSON.stringify(key)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

// ---------------------------------------------------------------------------
// The authenticated client
// ---------------------------------------------------------------------------

describe('AuthenticatedClient', () => {
  it('targets the host the config loader supplies', async () => {
    fetchMock.mockResolvedValue(gqlOk({ UserDetails: { id: 'u1' } }));

    await queryOptions.getUser().queryFn();

    expect(fetchMock.mock.calls[0][0]).toBe(HOST);
  });

  it('sends cookies with every request', async () => {
    fetchMock.mockResolvedValue(gqlOk({ UserDetails: { id: 'u1' } }));

    await queryOptions.getUser().queryFn();

    expect(sentInit().credentials).toBe('include');
  });

  it('sends no Authorization header: auth rides on HttpOnly cookies', async () => {
    fetchMock.mockResolvedValue(gqlOk({ UserDetails: { id: 'u1' } }));

    await queryOptions.getUser().queryFn();

    const headers = new Headers(sentInit().headers);
    expect(headers.get('authorization')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// What each queryFn asks for, and what it returns
// ---------------------------------------------------------------------------

describe('queryFn requests', () => {
  it('fetchHomePageData asks for 20 items', async () => {
    const payload = { homePageData: { topRatedAnimes: [] } };
    fetchMock.mockResolvedValue(gqlOk(payload));

    await expect(queryOptions.fetchHomePageData().queryFn()).resolves.toEqual(payload);
    expect(sentBody().operationName).toBe('getHomePageData');
    expect(sentBody().variables).toEqual({ limit: 20 });
  });

  it('fetchSeasonalAnime forwards the season and limit', async () => {
    fetchMock.mockResolvedValue(gqlOk({ seasonalAnime: [] }));

    await queryOptions.fetchSeasonalAnime('FALL_2025', 8).queryFn();

    expect(sentBody().operationName).toBe('getSeasonalAnime');
    expect(sentBody().variables).toEqual({ season: 'FALL_2025', limit: 8 });
  });

  it('fetchSeasonalAnime omits the limit when none was given', async () => {
    fetchMock.mockResolvedValue(gqlOk({ seasonalAnime: [] }));

    await queryOptions.fetchSeasonalAnime('FALL_2025').queryFn();

    expect(sentBody().variables).toEqual({ season: 'FALL_2025' });
  });

  it('fetchDetails sends the id', async () => {
    fetchMock.mockResolvedValue(gqlOk({ anime: { id: 'anime-1' } }));

    await expect(queryOptions.fetchDetails('anime-1').queryFn()).resolves.toEqual({
      anime: { id: 'anime-1' }
    });
    expect(sentBody().operationName).toBe('getAnimeDetailsByID');
    expect(sentBody().variables).toEqual({ id: 'anime-1' });
  });

  it('fetchDetails refuses an empty id before touching the network', async () => {
    await expect(queryOptions.fetchDetails('').queryFn()).rejects.toThrow(
      'ID is required to fetch anime details'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetchCurrentlyAiring derives a yesterday..+7d window and defaults the limit to 25', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z'));
      fetchMock.mockResolvedValue(gqlOk({ currentlyAiring: [] }));

      await queryOptions.fetchCurrentlyAiring().queryFn();

      expect(sentBody().variables).toEqual({
        input: {
          startDate: '2025-06-14T12:00:00.000Z',
          endDate: '2025-06-22T12:00:00.000Z'
        },
        limit: 25
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('fetchCurrentlyAiring honours an explicit limit', async () => {
    fetchMock.mockResolvedValue(gqlOk({ currentlyAiring: [] }));

    await queryOptions.fetchCurrentlyAiring(5).queryFn();

    expect(sentBody().variables.limit).toBe(5);
  });

  it('fetchCurrentlyAiringWithDates sends an explicit end date when it has one', async () => {
    fetchMock.mockResolvedValue(gqlOk({ currentlyAiring: [] }));

    await queryOptions
      .fetchCurrentlyAiringWithDates(
        new Date('2025-01-01T00:00:00.000Z'),
        new Date('2025-01-08T00:00:00.000Z'),
        undefined,
        10
      )
      .queryFn();

    expect(sentBody().variables).toEqual({
      input: { startDate: '2025-01-01T00:00:00.000Z', endDate: '2025-01-08T00:00:00.000Z' },
      limit: 10
    });
  });

  it('fetchCurrentlyAiringWithDates switches to daysInFuture without an end date', async () => {
    fetchMock.mockResolvedValue(gqlOk({ currentlyAiring: [] }));

    await queryOptions
      .fetchCurrentlyAiringWithDates(new Date('2025-01-01T00:00:00.000Z'), null, 3)
      .queryFn();

    expect(sentBody().variables).toEqual({
      input: { startDate: '2025-01-01T00:00:00.000Z', daysInFuture: 3 },
      limit: 25
    });
  });

  it('fetchCurrentlyAiringWithDatesAndEpisodes uses the episode-bearing document', async () => {
    fetchMock.mockResolvedValue(gqlOk({ currentlyAiring: [] }));

    await queryOptions
      .fetchCurrentlyAiringWithDatesAndEpisodes(new Date('2025-01-01T00:00:00.000Z'), null, 2, 4)
      .queryFn();

    expect(sentBody().operationName).toBe('currentlyAiringWithDateAndEpisodes');
    expect(sentBody().variables).toEqual({
      input: { startDate: '2025-01-01T00:00:00.000Z', daysInFuture: 2 },
      limit: 4
    });
  });

  it('getUser unwraps UserDetails', async () => {
    fetchMock.mockResolvedValue(gqlOk({ UserDetails: { id: 'u1', username: 'james' } }));

    await expect(queryOptions.getUser().queryFn()).resolves.toEqual({
      id: 'u1',
      username: 'james'
    });
    expect(sentBody().operationName).toBe('getUserDetails');
  });

  it('fetchUserAnimeCount unwraps UserAnimes and forwards its variables', async () => {
    fetchMock.mockResolvedValue(gqlOk({ UserAnimes: { total: 42, animes: [] } }));

    await expect(
      queryOptions.fetchUserAnimeCount({ status: 'WATCHING' } as never).queryFn()
    ).resolves.toEqual({ total: 42, animes: [] });
    expect(sentBody().operationName).toBe('UserAnimeCount');
    expect(sentBody().variables).toEqual({ status: 'WATCHING' });
  });

  it('fetchUserAnimes unwraps UserAnimes', async () => {
    fetchMock.mockResolvedValue(gqlOk({ UserAnimes: { animes: [{ id: 'ua1' }] } }));

    await expect(
      queryOptions.fetchUserAnimes({ status: 'COMPLETED' } as never).queryFn()
    ).resolves.toEqual({ animes: [{ id: 'ua1' }] });
  });

  it('fetchUserWorks unwraps UserWorks', async () => {
    fetchMock.mockResolvedValue(gqlOk({ UserWorks: { works: [] } }));

    await expect(
      queryOptions.fetchUserWorks({ status: 'READING' } as never).queryFn()
    ).resolves.toEqual({ works: [] });
    expect(sentBody().operationName).toBe('UserWorks');
  });

  it('the status-count queries send no variables', async () => {
    fetchMock.mockResolvedValue(gqlOk({ UserAnimeStatusCounts: [] }));
    await expect(queryOptions.fetchUserAnimeStatusCounts().queryFn()).resolves.toEqual([]);
    expect(sentBody().variables).toEqual({});

    fetchMock.mockResolvedValue(gqlOk({ UserWorkStatusCounts: [] }));
    await expect(queryOptions.fetchUserWorkStatusCounts().queryFn()).resolves.toEqual([]);
  });

  it('an empty collection comes back as an empty collection, not an error', async () => {
    fetchMock.mockResolvedValue(gqlOk({ UserAnimes: { animes: [] } }));

    await expect(
      queryOptions.fetchUserAnimes({ status: 'DROPPED' } as never).queryFn()
    ).resolves.toEqual({ animes: [] });
  });

  it('watchedEpisodes unwraps WatchedEpisodes for one anime', async () => {
    fetchMock.mockResolvedValue(gqlOk({ WatchedEpisodes: [{ episodeId: 'e1' }] }));

    await expect(queryOptions.watchedEpisodes('anime-1').queryFn()).resolves.toEqual([
      { episodeId: 'e1' }
    ]);
    expect(sentBody().variables).toEqual({ animeID: 'anime-1' });
  });

  it('readChapters unwraps ReadChapters for one work', async () => {
    fetchMock.mockResolvedValue(gqlOk({ ReadChapters: [] }));

    await expect(queryOptions.readChapters('work-1').queryFn()).resolves.toEqual([]);
    expect(sentBody().variables).toEqual({ workID: 'work-1' });
  });

  it('getCharactersAndStaffByAnimeID unwraps the lowercase field name', async () => {
    fetchMock.mockResolvedValue(
      gqlOk({ charactersAndStaffByAnimeId: [{ id: 'c1' }] })
    );

    await expect(
      queryOptions.getCharactersAndStaffByAnimeID('anime-1').queryFn()
    ).resolves.toEqual([{ id: 'c1' }]);
    expect(sentBody().variables).toEqual({ animeId: 'anime-1' });
  });

  it('propagates a null field rather than inventing a default', async () => {
    fetchMock.mockResolvedValue(gqlOk({ charactersAndStaffByAnimeId: null }));

    await expect(
      queryOptions.getCharactersAndStaffByAnimeID('anime-1').queryFn()
    ).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Failure modes
// ---------------------------------------------------------------------------

describe('queryFn failures', () => {
  it('propagates a rejected fetch', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(queryOptions.fetchHomePageData().queryFn()).rejects.toThrow('network down');
  });

  it('propagates a 500 as an error rather than resolving with nothing', async () => {
    fetchMock.mockResolvedValue(httpStatus(500, 'upstream exploded'));

    await expect(queryOptions.fetchHomePageData().queryFn()).rejects.toThrow();
  });

  it('propagates a non-auth GraphQL error without retrying', async () => {
    fetchMock.mockResolvedValue(gqlErrors([{ message: 'Variable "$limit" is invalid' }]));

    await expect(queryOptions.fetchHomePageData().queryFn()).rejects.toThrow(/invalid/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not treat a 200 with null data as success', async () => {
    fetchMock.mockResolvedValue(gqlOk(null));

    await expect(queryOptions.fetchHomePageData().queryFn()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// executeWithAutoRefresh
// ---------------------------------------------------------------------------

describe('executeWithAutoRefresh', () => {
  it('returns the first successful result without refreshing anything', async () => {
    const operation = vi.fn(async () => 'ok');

    await expect(queryOptions.executeWithAutoRefresh(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    'Access denied',
    'unauthorized',
    'invalid token',
    'jwt expired',
    'authentication failed',
    'forbidden'
  ])('refreshes and retries once on %j', async (message) => {
    mockAuthStorage.getRefreshToken.mockReturnValue('refresh-me');
    fetchMock.mockResolvedValue(
      gqlOk({ RefreshToken: { id: 'u1', Credentials: { token: 'new', refresh_token: 'r2' } } })
    );
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error(message))
      .mockResolvedValueOnce('second attempt');

    await expect(queryOptions.executeWithAutoRefresh(operation)).resolves.toBe('second attempt');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(1); // the refresh
  });

  it('detects an auth error carried in a GraphQL errors array', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue('refresh-me');
    fetchMock.mockResolvedValue(
      gqlOk({ RefreshToken: { id: 'u1', Credentials: { token: 'new' } } })
    );
    const authError = Object.assign(new Error('GraphQL Error'), {
      response: { errors: [{ message: 'Access denied for field UserDetails' }] }
    });
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(authError)
      .mockResolvedValueOnce('ok');

    await expect(queryOptions.executeWithAutoRefresh(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-auth error', async () => {
    const operation = vi.fn(async () => {
      throw new Error('Request timeout');
    });

    await expect(queryOptions.executeWithAutoRefresh(operation)).rejects.toThrow('Request timeout');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('clears tokens and rethrows when there is no refresh token to use', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue(null);
    const operation = vi.fn(async () => {
      throw new Error('Access denied');
    });

    await expect(queryOptions.executeWithAutoRefresh(operation)).rejects.toThrow('Access denied');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(mockAuthStorage.clearTokens).toHaveBeenCalled();
  });

  it('marks the persisted store logged out when the refresh cannot be done', async () => {
    localStorage.setItem(
      'logged-in-store',
      JSON.stringify({ state: { isLoggedIn: true, authInitialized: false } })
    );
    mockAuthStorage.getRefreshToken.mockReturnValue(null);

    await expect(
      queryOptions.executeWithAutoRefresh(async () => {
        throw new Error('unauthorized');
      })
    ).rejects.toThrow();

    expect(JSON.parse(localStorage.getItem('logged-in-store')!)).toEqual({
      state: { isLoggedIn: false, authInitialized: true }
    });
  });

  it('leaves a store with no state block alone', async () => {
    localStorage.setItem('logged-in-store', JSON.stringify({ version: 1 }));
    mockAuthStorage.getRefreshToken.mockReturnValue(null);

    await expect(
      queryOptions.executeWithAutoRefresh(async () => {
        throw new Error('unauthorized');
      })
    ).rejects.toThrow();

    expect(JSON.parse(localStorage.getItem('logged-in-store')!)).toEqual({ version: 1 });
  });

  it('gives up after the retry budget rather than looping', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue('refresh-me');
    fetchMock.mockResolvedValue(
      gqlOk({ RefreshToken: { id: 'u1', Credentials: { token: 'new' } } })
    );
    const operation = vi.fn(async () => {
      throw new Error('Access denied');
    });

    await expect(queryOptions.executeWithAutoRefresh(operation)).rejects.toThrow('Access denied');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(mockAuthStorage.clearTokens).toHaveBeenCalled();
  });

  it('honours a larger maxRetries', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue('refresh-me');
    // a fresh Response per call: a body can only be read once
    fetchMock.mockImplementation(async () =>
      gqlOk({ RefreshToken: { id: 'u1', Credentials: { token: 'new' } } })
    );
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('Access denied'))
      .mockRejectedValueOnce(new Error('Access denied'))
      .mockResolvedValueOnce('third time');

    await expect(queryOptions.executeWithAutoRefresh(operation, 2)).resolves.toBe('third time');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('stops when the refresh request itself fails', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue('refresh-me');
    fetchMock.mockResolvedValue(httpStatus(401));
    const operation = vi.fn(async () => {
      throw new Error('Access denied');
    });

    await expect(queryOptions.executeWithAutoRefresh(operation)).rejects.toThrow('Access denied');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(mockAuthStorage.clearTokens).toHaveBeenCalled();
  });

  it('treats an error with no message as non-auth', async () => {
    const operation = vi.fn(async () => {
      throw {};
    });

    await expect(queryOptions.executeWithAutoRefresh(operation)).rejects.toEqual({});
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

describe('withAutoRefresh', () => {
  it('wraps a bare fn into one that retries auth failures', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue('refresh-me');
    fetchMock.mockResolvedValue(
      gqlOk({ RefreshToken: { id: 'u1', Credentials: { token: 'new' } } })
    );
    const inner = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('Access denied'))
      .mockResolvedValueOnce('done');

    const wrapped = queryOptions.withAutoRefresh(inner);

    await expect(wrapped()).resolves.toBe('done');
    expect(inner).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// executeWithAutoRefreshSSR
// ---------------------------------------------------------------------------

describe('executeWithAutoRefreshSSR', () => {
  it('hands the operation the auth token it found in the cookie string', async () => {
    mockAuthStorage.getTokenFromCookieString.mockReturnValue('cookie-token');
    const operation = vi.fn(async () => 'ok');

    await expect(
      queryOptions.executeWithAutoRefreshSSR(operation, 'auth_token=cookie-token')
    ).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledWith('cookie-token');
  });

  it('passes undefined when there is no cookie string at all', async () => {
    const operation = vi.fn(async () => 'ok');

    await queryOptions.executeWithAutoRefreshSSR(operation);

    expect(operation).toHaveBeenCalledWith(undefined);
  });

  it('refreshes over the cookie header and retries with the new token', async () => {
    mockAuthStorage.getTokenFromCookieString.mockReturnValue('old-token');
    mockAuthStorage.getTokensFromCookieString.mockReturnValue({ refreshToken: 'r1' });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { RefreshToken: { id: 'u1', Credentials: { token: 'fresh-token' } } }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    const operation = vi
      .fn<(token?: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('jwt expired'))
      .mockResolvedValueOnce('ok');

    await expect(
      queryOptions.executeWithAutoRefreshSSR(operation, 'refresh_token=r1')
    ).resolves.toBe('ok');

    expect(operation).toHaveBeenNthCalledWith(2, 'fresh-token');
    // the refresh call carries the caller's cookies forward
    expect(sentInit().headers.Cookie).toBe('refresh_token=r1');
    expect(sentBody().variables).toEqual({ token: 'r1' });
  });

  it('does not attempt a refresh without a cookie string', async () => {
    const operation = vi.fn(async () => {
      throw new Error('Access denied');
    });

    await expect(queryOptions.executeWithAutoRefreshSSR(operation)).rejects.toThrow(
      'Access denied'
    );
    expect(operation).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives up when the cookies carry no refresh token', async () => {
    mockAuthStorage.getTokensFromCookieString.mockReturnValue({ authToken: 'a1' });
    const operation = vi.fn(async () => {
      throw new Error('Access denied');
    });

    await expect(
      queryOptions.executeWithAutoRefreshSSR(operation, 'auth_token=a1')
    ).rejects.toThrow('Access denied');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives up when the refresh endpoint answers non-2xx', async () => {
    mockAuthStorage.getTokensFromCookieString.mockReturnValue({ refreshToken: 'r1' });
    fetchMock.mockResolvedValue(httpStatus(502));
    const operation = vi.fn(async () => {
      throw new Error('Access denied');
    });

    await expect(
      queryOptions.executeWithAutoRefreshSSR(operation, 'refresh_token=r1')
    ).rejects.toThrow('Access denied');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('gives up when the refresh answers 200 with GraphQL errors', async () => {
    mockAuthStorage.getTokensFromCookieString.mockReturnValue({ refreshToken: 'r1' });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: 'refresh token revoked' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    const operation = vi.fn(async () => {
      throw new Error('Access denied');
    });

    await expect(
      queryOptions.executeWithAutoRefreshSSR(operation, 'refresh_token=r1')
    ).rejects.toThrow('Access denied');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry a non-auth failure', async () => {
    mockAuthStorage.getTokensFromCookieString.mockReturnValue({ refreshToken: 'r1' });
    const operation = vi.fn(async () => {
      throw new Error('Request timeout');
    });

    await expect(
      queryOptions.executeWithAutoRefreshSSR(operation, 'refresh_token=r1')
    ).rejects.toThrow('Request timeout');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('withAutoRefreshSSR', () => {
  it('turns a token-taking fn into a cookie-string-taking one', async () => {
    mockAuthStorage.getTokenFromCookieString.mockReturnValue('cookie-token');
    const inner = vi.fn(async (token?: string) => `saw:${token}`);

    const wrapped = queryOptions.withAutoRefreshSSR(inner);

    await expect(wrapped('auth_token=cookie-token')).resolves.toBe('saw:cookie-token');
  });
});

// ---------------------------------------------------------------------------
// refreshTokenSimple
// ---------------------------------------------------------------------------

describe('refreshTokenSimple', () => {
  it('refuses without a refresh token, before touching the network', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue(null);

    await expect(queryOptions.refreshTokenSimple()).rejects.toThrow(
      'No refresh token available'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the stored refresh token to the gateway', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue('r1');
    fetchMock.mockResolvedValue(
      gqlOk({ RefreshToken: { id: 'u1', Credentials: { token: 't2', refresh_token: 'r2' } } })
    );

    await queryOptions.refreshTokenSimple();

    expect(fetchMock.mock.calls[0][0]).toBe(HOST);
    expect(sentInit().method).toBe('POST');
    expect(sentInit().credentials).toBe('include');
    expect(sentInit().headers['Content-Type']).toBe('application/json');
    expect(sentBody().variables).toEqual({ token: 'r1' });
    expect(sentBody().query).toContain('mutation RefreshToken');
  });

  it('returns the credentials and stores the rotated refresh token', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue('r1');
    fetchMock.mockResolvedValue(
      gqlOk({ RefreshToken: { id: 'u1', Credentials: { token: 't2', refresh_token: 'r2' } } })
    );

    await expect(queryOptions.refreshTokenSimple()).resolves.toEqual({
      id: 'u1',
      Credentials: { token: 't2', refresh_token: 'r2' }
    });
    expect(mockAuthStorage.setRefreshTokenLocalStorage).toHaveBeenCalledWith('r2');
    expect(mockAuthStorage.setTokensForLocalhost).toHaveBeenCalledWith('t2', 'r2');
  });

  it('still sets the access token when the server did not rotate the refresh token', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue('r1');
    fetchMock.mockResolvedValue(
      gqlOk({ RefreshToken: { id: 'u1', Credentials: { token: 't2', refresh_token: null } } })
    );

    await queryOptions.refreshTokenSimple();

    expect(mockAuthStorage.setRefreshTokenLocalStorage).not.toHaveBeenCalled();
    expect(mockAuthStorage.setTokensForLocalhost).toHaveBeenCalledWith('t2', undefined);
  });

  it('throws on a non-2xx without clearing the stored tokens', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue('r1');
    fetchMock.mockResolvedValue(httpStatus(503));

    await expect(queryOptions.refreshTokenSimple()).rejects.toThrow('HTTP error! status: 503');
    // clearing here would destroy the only chance of a later retry succeeding
    expect(mockAuthStorage.clearTokens).not.toHaveBeenCalled();
  });

  it('throws the first GraphQL error from a 200', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue('r1');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: 'refresh token revoked' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    await expect(queryOptions.refreshTokenSimple()).rejects.toThrow('refresh token revoked');
  });

  it('falls back to a generic message when the GraphQL error has none', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue('r1');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{}] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    await expect(queryOptions.refreshTokenSimple()).rejects.toThrow('Refresh token failed');
  });

  it('propagates a rejected fetch', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue('r1');
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(queryOptions.refreshTokenSimple()).rejects.toThrow('network down');
  });

  it('inspects the Set-Cookie the server sent back', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue('r1');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ data: { RefreshToken: { id: 'u1', Credentials: { token: 't2' } } } }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'set-cookie': 'access_token=t2; Path=/; HttpOnly; Secure; SameSite=Lax; Domain=weeb.vip'
          }
        }
      )
    );

    await queryOptions.refreshTokenSimple();

    expect(mockDebug.auth).toHaveBeenCalledWith(
      'Set-Cookie header analysis:',
      expect.objectContaining({
        hasHttpOnly: true,
        hasSecure: true,
        sameSiteValue: 'Lax',
        domainValue: 'weeb.vip',
        pathValue: '/'
      })
    );
  });

  it('warns when the server set no cookies at all', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue('r1');
    fetchMock.mockResolvedValue(
      gqlOk({ RefreshToken: { id: 'u1', Credentials: { token: 't2' } } })
    );

    await queryOptions.refreshTokenSimple();

    expect(mockDebug.warn).toHaveBeenCalledWith(
      'No set-cookie headers found in response - server may not be setting cookies'
    );
  });

  it('throws on a 200 whose body carries no RefreshToken payload', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue('r1');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    await expect(queryOptions.refreshTokenSimple()).rejects.toThrow();
  });

  it('tolerates a response with credentials missing', async () => {
    mockAuthStorage.getRefreshToken.mockReturnValue('r1');
    fetchMock.mockResolvedValue(gqlOk({ RefreshToken: { id: 'u1' } }));

    await expect(queryOptions.refreshTokenSimple()).resolves.toEqual({ id: 'u1' });
    expect(mockAuthStorage.setTokensForLocalhost).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

describe('auth mutations', () => {
  it('register unwraps Register', async () => {
    fetchMock.mockResolvedValue(gqlOk({ Register: { id: 'u1' } }));

    await expect(
      queryOptions.register().mutationFn({ input: { username: 'a', password: 'b' } as never })
    ).resolves.toEqual({ id: 'u1' });
    expect(sentBody().operationName).toBe('Register');
    expect(sentBody().variables).toEqual({ input: { username: 'a', password: 'b' } });
  });

  it('login unwraps CreateSession', async () => {
    fetchMock.mockResolvedValue(
      gqlOk({ CreateSession: { id: 'u1', Credentials: { token: 't' } } })
    );

    await expect(
      queryOptions.login().mutationFn({ input: { username: 'a', password: 'b' } as never })
    ).resolves.toEqual({ id: 'u1', Credentials: { token: 't' } });
    expect(sentBody().operationName).toBe('CreateSession');
  });

  it('login surfaces bad credentials as a rejection', async () => {
    fetchMock.mockResolvedValue(gqlErrors([{ message: 'invalid username or password' }]));

    await expect(
      queryOptions.login().mutationFn({ input: { username: 'a', password: 'b' } as never })
    ).rejects.toThrow(/invalid username or password/);
  });

  it('requestPasswordReset unwraps the boolean', async () => {
    fetchMock.mockResolvedValue(gqlOk({ RequestPasswordReset: true }));

    await expect(
      queryOptions.requestPasswordReset().mutationFn({ input: { email: 'a@b.c' } as never })
    ).resolves.toBe(true);
  });

  it('resetPassword unwraps the boolean', async () => {
    fetchMock.mockResolvedValue(gqlOk({ ResetPassword: false }));

    await expect(
      queryOptions.resetPassword().mutationFn({ input: { token: 't', password: 'p' } as never })
    ).resolves.toBe(false);
  });

  it('resendVerificationEmail forwards the username', async () => {
    fetchMock.mockResolvedValue(gqlOk({ ResendVerificationEmail: true }));

    await expect(
      queryOptions.resendVerificationEmail().mutationFn({ username: 'james' })
    ).resolves.toBe(true);
    expect(sentBody().variables).toEqual({ username: 'james' });
  });

  it('logout unwraps Logout', async () => {
    fetchMock.mockResolvedValue(gqlOk({ Logout: true }));

    await expect(queryOptions.logout().mutationFn()).resolves.toBe(true);
    expect(sentBody().operationName).toBe('Logout');
  });

  describe('verifyEmail', () => {
    it('sends the verification token as a bearer header, not a cookie', async () => {
      fetchMock.mockResolvedValue(
        gqlOk({ VerifyEmailWithUser: { success: true, userID: 'u1' } })
      );

      await queryOptions.verifyEmail('verify-token').mutationFn();

      const headers = new Headers(sentInit().headers);
      expect(headers.get('authorization')).toBe('Bearer verify-token');
      expect(sentInit().credentials).toBe('include');
      expect(sentBody().query).toContain('VerifyEmailWithUser');
    });

    it('returns the success flag and the linked user id', async () => {
      fetchMock.mockResolvedValue(
        gqlOk({ VerifyEmailWithUser: { success: true, userID: 'u1' } })
      );

      await expect(queryOptions.verifyEmail('t').mutationFn()).resolves.toEqual({
        success: true,
        userID: 'u1'
      });
    });

    it('resolves -- it does not throw -- when verification simply did not succeed', async () => {
      // The caller gates on `success`; a false here is a normal answer, e.g. an
      // already-used link.
      fetchMock.mockResolvedValue(
        gqlOk({ VerifyEmailWithUser: { success: false, userID: null } })
      );

      await expect(queryOptions.verifyEmail('t').mutationFn()).resolves.toEqual({
        success: false,
        userID: null
      });
    });

    it('rejects on an expired link', async () => {
      fetchMock.mockResolvedValue(gqlErrors([{ message: 'token expired' }]));

      await expect(queryOptions.verifyEmail('t').mutationFn()).rejects.toThrow(/token expired/);
    });
  });
});

describe('list mutations', () => {
  it('updateUserDetails wraps the input and unwraps the result', async () => {
    fetchMock.mockResolvedValue(gqlOk({ UpdateUserDetails: { id: 'u1', firstname: 'J' } }));

    await expect(
      queryOptions.updateUserDetails().mutationFn({ firstname: 'J' } as never)
    ).resolves.toEqual({ id: 'u1', firstname: 'J' });
    expect(sentBody().variables).toEqual({ input: { firstname: 'J' } });
  });

  it('upsertAnime unwraps AddAnime', async () => {
    fetchMock.mockResolvedValue(gqlOk({ AddAnime: { id: 'ua1' } }));

    await expect(
      queryOptions.upsertAnime().mutationFn({ input: { animeID: 'a1' } as never })
    ).resolves.toEqual({ id: 'ua1' });
    expect(sentBody().operationName).toBe('AddAnime');
  });

  it('deleteAnime sends the id as `input` and unwraps DeleteAnime', async () => {
    fetchMock.mockResolvedValue(gqlOk({ DeleteAnime: { id: 'ua1' } }));

    await expect(queryOptions.deleteAnime().mutationFn('ua1')).resolves.toEqual({ id: 'ua1' });
    expect(sentBody().variables).toEqual({ input: 'ua1' });
  });

  it('upsertWork unwraps AddWork', async () => {
    fetchMock.mockResolvedValue(gqlOk({ AddWork: { id: 'uw1' } }));

    await expect(
      queryOptions.upsertWork().mutationFn({ input: { workID: 'w1' } as never })
    ).resolves.toEqual({ id: 'uw1' });
    expect(sentBody().operationName).toBe('AddWork');
  });

  it('deleteWork sends the id as `input` and unwraps DeleteWork', async () => {
    fetchMock.mockResolvedValue(gqlOk({ DeleteWork: { id: 'uw1' } }));

    await expect(queryOptions.deleteWork().mutationFn('uw1')).resolves.toEqual({ id: 'uw1' });
    expect(sentBody().variables).toEqual({ input: 'uw1' });
  });

  it.each([
    ['markEpisodeWatched', () => queryOptions.markEpisodeWatched(), 'MarkEpisodeWatched'],
    ['unmarkEpisodeWatched', () => queryOptions.unmarkEpisodeWatched(), 'UnmarkEpisodeWatched']
  ])('%s posts the episode input', async (_name, factory, operationName) => {
    fetchMock.mockResolvedValue(gqlOk({ [operationName]: true }));

    await expect(
      factory().mutationFn({ input: { animeID: 'a1', episodeID: 'e1' } as never })
    ).resolves.toBe(true);
    expect(sentBody().operationName).toBe(operationName);
    expect(sentBody().variables).toEqual({ input: { animeID: 'a1', episodeID: 'e1' } });
  });

  it.each([
    ['markChapterRead', () => queryOptions.markChapterRead(), 'MarkChapterRead'],
    ['unmarkChapterRead', () => queryOptions.unmarkChapterRead(), 'UnmarkChapterRead']
  ])('%s posts the chapter input', async (_name, factory, operationName) => {
    fetchMock.mockResolvedValue(gqlOk({ [operationName]: true }));

    await expect(
      factory().mutationFn({ input: { workID: 'w1', chapterID: 'c1' } as never })
    ).resolves.toBe(true);
    expect(sentBody().operationName).toBe(operationName);
  });

  it('retries a write once the token has been refreshed', async () => {
    // The regression this guards: mutations used to call the client directly,
    // so a 24h-expired token made "remove from list" silently fail.
    mockAuthStorage.getRefreshToken.mockReturnValue('r1');
    fetchMock
      .mockResolvedValueOnce(gqlErrors([{ message: 'Access denied' }]))
      .mockResolvedValueOnce(
        gqlOk({ RefreshToken: { id: 'u1', Credentials: { token: 't2' } } })
      )
      .mockResolvedValueOnce(gqlOk({ DeleteAnime: { id: 'ua1' } }));

    await expect(queryOptions.deleteAnime().mutationFn('ua1')).resolves.toEqual({ id: 'ua1' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('surfaces a write that fails for a non-auth reason', async () => {
    fetchMock.mockResolvedValue(gqlErrors([{ message: 'work already on list' }]));

    await expect(
      queryOptions.upsertWork().mutationFn({ input: { workID: 'w1' } as never })
    ).rejects.toThrow(/already on list/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
