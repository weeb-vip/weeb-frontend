import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The profile dashboard's server loader. What is worth pinning:
 *
 *  - a signed-out visit must not spend six round trips discovering it has
 *    nothing to prefetch, but the airing window is public and still fetched,
 *  - the list limits (six watching, twelve reading) are deliberate: these
 *    queries select every episode of every entry, so a larger limit pulled
 *    tens of thousands of rows,
 *  - each result is unwrapped to exactly the shape its own queryFn returns, so
 *    the client can hand it straight to initialData instead of refetching,
 *  - the window bounds are echoed back so the client's query key matches.
 */

const fetchWithFallback = vi.fn();
const wasTokenExpired = vi.fn(() => false);
const makeSSRFetcher = vi.fn(() => ({ fetchWithFallback, wasTokenExpired }));

vi.mock('$lib/server/ssr-graphql', () => ({
  makeSSRFetcher: (...args: unknown[]) => (makeSSRFetcher as any)(...args),
  cookieHeaderFrom: () => 'cookie-header',
  publicAuth: (auth: any) => ({ isLoggedIn: !!auth?.isLoggedIn, source: 'publicAuth' }),
  loggedOutAuth: () => ({ isLoggedIn: false, source: 'loggedOutAuth' })
}));

const { load } = await import('./+page.server');

/**
 * `load` is declared as returning `data | void`, so every field read off it
 * would be a type error. Narrow it once, here.
 */
type Loaded = Exclude<Awaited<ReturnType<typeof load>>, void>;
const run = async (args: any): Promise<Loaded> => (await load(args)) as Loaded;
const {
  queryUserDetails,
  queryUserAnimes,
  queryUserWorks,
  queryUserAnimeStatusCounts,
  queryUserWorkStatusCounts,
  getCurrentlyAiringWithDatesAndEpisodes
} = await import('$lib/services/api/graphql/queries');
const { Status, WorkStatus } = await import('../../gql/graphql');

function event(loggedIn = true) {
  return {
    locals: {
      auth: { isLoggedIn: loggedIn, hasAuthToken: loggedIn, hasRefreshToken: loggedIn },
      config: { graphql_host: 'https://api.test/graphql' }
    },
    cookies: {}
  } as any;
}

/** The requests made, keyed by the description the loader gives each one. */
function callsByDescription() {
  return new Map(fetchWithFallback.mock.calls.map((call: any[]) => [call[2], call] as const));
}

function answers(byDescription: Record<string, unknown>) {
  fetchWithFallback.mockImplementation(
    async (_query: unknown, _vars: unknown, description: string) =>
      description in byDescription ? byDescription[description] : null
  );
}

beforeEach(() => {
  fetchWithFallback.mockReset();
  fetchWithFallback.mockResolvedValue(null);
  wasTokenExpired.mockReset();
  wasTokenExpired.mockReturnValue(false);
  makeSSRFetcher.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('what a signed-in visit prefetches', () => {
  it('is six requests: five watchlist queries and the public airing window', async () => {
    await run(event());

    expect(fetchWithFallback).toHaveBeenCalledTimes(6);
    expect([...callsByDescription().keys()].sort()).toEqual([
      'anime status counts',
      'currently airing',
      'reading list',
      'user details',
      'watching list',
      'work status counts'
    ]);
  });

  it('asks for the signed-in user with no variables', async () => {
    await run(event());

    const call = callsByDescription().get('user details')!;
    expect(call[0]).toBe(queryUserDetails);
    expect(call[1]).toEqual({});
  });

  it('asks for six watching entries, because the dashboard renders six', async () => {
    // These entries carry every episode and synopsis; the old limit of 1000
    // pulled tens of thousands of episode rows into this one response.
    await run(event());

    const call = callsByDescription().get('watching list')!;
    expect(call[0]).toBe(queryUserAnimes);
    expect(call[1]).toEqual({ input: { status: Status.Watching, limit: 6, page: 1 } });
  });

  it('asks for twelve reading entries, matching the Currently Reading row', async () => {
    await run(event());

    const call = callsByDescription().get('reading list')!;
    expect(call[0]).toBe(queryUserWorks);
    expect(call[1]).toEqual({ input: { status: WorkStatus.Reading, limit: 12, page: 1 } });
  });

  it('takes the stat totals from the count queries rather than counting rows', async () => {
    await run(event());

    expect(callsByDescription().get('anime status counts')![0]).toBe(queryUserAnimeStatusCounts);
    expect(callsByDescription().get('anime status counts')![1]).toEqual({});
    expect(callsByDescription().get('work status counts')![0]).toBe(queryUserWorkStatusCounts);
    expect(callsByDescription().get('work status counts')![1]).toEqual({});
  });

  it('asks for a week either side of now, at a limit of 25', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));

    await run(event());

    const call = callsByDescription().get('currently airing')!;
    expect(call[0]).toBe(getCurrentlyAiringWithDatesAndEpisodes);
    expect(call[1]).toEqual({
      input: {
        startDate: new Date('2026-04-08T12:00:00Z'),
        endDate: new Date('2026-04-22T12:00:00Z')
      },
      limit: 25
    });
  });

  it('builds the fetcher against the configured host and the request cookies', async () => {
    await run(event());

    expect(makeSSRFetcher).toHaveBeenCalledWith('https://api.test/graphql', 'cookie-header');
  });
});

describe('what a signed-out visit prefetches', () => {
  it('is only the public airing window -- every watchlist query needs a user', async () => {
    await run(event(false));

    expect(fetchWithFallback).toHaveBeenCalledTimes(1);
    expect(fetchWithFallback.mock.calls[0][2]).toBe('currently airing');
  });

  it('leaves every watchlist slot null without asking', async () => {
    answers({ 'currently airing': { getAiringAnimeAll: [{ id: 'a1' }] } });

    const result = await run(event(false));

    expect(result.ssr.user).toBeNull();
    expect(result.ssr.watching).toBeNull();
    expect(result.ssr.reading).toBeNull();
    expect(result.ssr.animeCounts).toBeNull();
    expect(result.ssr.workCounts).toBeNull();
    expect(result.ssr.currentlyAiring).toEqual({ getAiringAnimeAll: [{ id: 'a1' }] });
  });
});

describe('the shapes handed to the client', () => {
  it('unwraps each list to what its own queryFn returns', async () => {
    answers({
      'user details': { UserDetails: { id: 'u1', username: 'weeb' } },
      'watching list': { UserAnimes: { animes: [{ id: 'w1' }], total: 40 } },
      'reading list': { UserWorks: { works: [{ id: 'r1' }], total: 9 } },
      'anime status counts': { UserAnimeStatusCounts: { WATCHING: 40 } },
      'work status counts': { UserWorkStatusCounts: { READING: 9 } },
      'currently airing': { getAiringAnimeAll: [{ id: 'a1' }] }
    });

    const result = await run(event());

    expect(result.ssr.user).toEqual({ id: 'u1', username: 'weeb' });
    expect(result.ssr.watching).toEqual({ animes: [{ id: 'w1' }], total: 40 });
    expect(result.ssr.reading).toEqual({ works: [{ id: 'r1' }], total: 9 });
    expect(result.ssr.animeCounts).toEqual({ WATCHING: 40 });
    expect(result.ssr.workCounts).toEqual({ READING: 9 });
  });

  it('keeps the airing response whole, unlike the lists', async () => {
    const airing = { getAiringAnimeAll: [{ id: 'a1', episodes: [] }] };
    answers({ 'currently airing': airing });

    expect((await run(event())).ssr.currentlyAiring).toEqual(airing);
  });

  it('echoes the window bounds as ISO strings, so the client keys the same query', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));

    const result = await run(event());

    expect(result.ssr.startDate).toBe('2026-04-08T12:00:00.000Z');
    expect(result.ssr.endDate).toBe('2026-04-22T12:00:00.000Z');
    const call = callsByDescription().get('currently airing')!;
    expect(call[1].input.startDate.toISOString()).toBe(result.ssr.startDate);
    expect(call[1].input.endDate.toISOString()).toBe(result.ssr.endDate);
  });
});

describe('a failed or empty answer', () => {
  // FINDING, pinned as it stands: this loader returns no ssrError at all, so a
  // subgraph outage and a brand-new empty account produce the same payload.
  it('is null everywhere when every request answered null', async () => {
    fetchWithFallback.mockResolvedValue(null);

    const result = await run(event());

    expect(result.ssr.user).toBeNull();
    expect(result.ssr.watching).toBeNull();
    expect(result.ssr.currentlyAiring).toBeNull();
    expect(result).not.toHaveProperty('ssrError');
  });

  it('is null for a response that carried no wrapper field', async () => {
    answers({ 'user details': { somethingElse: true }, 'watching list': {} });

    const result = await run(event());

    expect(result.ssr.user).toBeNull();
    expect(result.ssr.watching).toBeNull();
  });

  it('keeps an empty list as an empty list, not as null', async () => {
    answers({ 'watching list': { UserAnimes: { animes: [], total: 0 } } });

    expect((await run(event())).ssr.watching).toEqual({ animes: [], total: 0 });
  });

  it('lets one failed request through without taking the others with it', async () => {
    fetchWithFallback.mockImplementation(
      async (_query: unknown, _vars: unknown, description: string) => {
        if (description === 'user details') return null;
        return { UserAnimes: { animes: [{ id: 'w1' }] }, getAiringAnimeAll: [] };
      }
    );

    const result = await run(event());

    expect(result.ssr.user).toBeNull();
    expect(result.ssr.watching).toEqual({ animes: [{ id: 'w1' }] });
  });
});

describe('the auth state handed to the client', () => {
  it('is the public view of locals.auth on a normal render', async () => {
    const result = await run(event());

    expect(result.auth).toEqual({ isLoggedIn: true, source: 'publicAuth' });
    expect(result.isTokenExpired).toBe(false);
  });

  it('is blanked out when SSR found the token expired', async () => {
    wasTokenExpired.mockReturnValue(true);

    const result = await run(event());

    expect(result.auth).toEqual({ isLoggedIn: false, source: 'loggedOutAuth' });
    expect(result.isTokenExpired).toBe(true);
  });
});
