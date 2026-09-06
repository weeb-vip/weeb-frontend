import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The homepage server loader. Four independent shelves are fetched in one
 * settled batch, so the rules worth pinning are the ones a reader cannot see
 * went wrong:
 *
 *  - which document is asked for with which variables (the client re-keys its
 *    own queries off these, so a changed variable means a refetch on hydrate),
 *  - one shelf failing must not take the other three down,
 *  - the banner preload hint has to point at the configured CDN, not a
 *    hardcoded one, or it warms the wrong origin,
 *  - an expired token blanks the auth state handed to the client.
 *
 * The GraphQL layer is mocked at the module seam (`$lib/server/ssr-graphql`)
 * so nothing is fetched; `fetchWithFallback` is a spy whose calls ARE the
 * assertion about what was requested.
 */

const fetchWithFallback = vi.fn();
const wasTokenExpired = vi.fn(() => false);
const makeSSRFetcher = vi.fn(() => ({ fetchWithFallback, wasTokenExpired }));

vi.mock('$lib/server/ssr-graphql', () => ({
  makeSSRFetcher: (...args: unknown[]) => (makeSSRFetcher as any)(...args),
  cookieHeaderFrom: () => 'cookie-header',
  getCurrentSeason: () => 'SPRING_2026',
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
  getHomePageData,
  getCurrentlyAiringWithDates,
  getSeasonalAnime,
  getCurrentlyPublishingWorks
} = await import('$lib/services/api/graphql/queries');

/** The load event, with only the bits this loader reads. */
function event(overrides: Record<string, unknown> = {}) {
  return {
    locals: {
      auth: { isLoggedIn: true, hasAuthToken: true, hasRefreshToken: true },
      config: { graphql_host: 'https://api.test/graphql', cdn_url: 'https://cdn.test/weeb' }
    },
    cookies: {},
    ...overrides
  } as any;
}

/** Route each of the four requests by the description the loader passes. */
function answers(byDescription: Record<string, unknown>) {
  fetchWithFallback.mockImplementation(async (_query: unknown, _vars: unknown, description: string) =>
    description in byDescription ? byDescription[description] : null
  );
}

const AIRING_ONE = { getAiringAnimeAll: [{ id: 'anime-1' }] };

beforeEach(() => {
  fetchWithFallback.mockReset();
  fetchWithFallback.mockResolvedValue(null);
  wasTokenExpired.mockReset();
  wasTokenExpired.mockReturnValue(false);
  makeSSRFetcher.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The four calls, keyed by the description the loader gives each one. */
function callsByDescription() {
  const entries = fetchWithFallback.mock.calls.map((call: any[]) => [call[2], call] as const);
  return new Map(entries);
}

describe('what the homepage asks for', () => {
  it('makes exactly four requests, one per shelf, in a single batch', async () => {
    await run(event());

    expect(fetchWithFallback).toHaveBeenCalledTimes(4);
    expect([...callsByDescription().keys()]).toEqual([
      'home data',
      'currently airing data',
      'seasonal data',
      'publishing works'
    ]);
  });

  it('asks for the top-rated shelf with a limit of 20', async () => {
    await run(event());

    const call = callsByDescription().get('home data')!;
    expect(call[0]).toBe(getHomePageData);
    expect(call[1]).toEqual({ limit: 20 });
  });

  it('asks for a week of airing shows starting an hour ago, so one just aired still shows', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T12:00:00Z'));

    await run(event());

    const call = callsByDescription().get('currently airing data')!;
    expect(call[0]).toBe(getCurrentlyAiringWithDates);
    expect(call[1]).toEqual({
      input: {
        startDate: new Date('2026-04-01T11:00:00Z'),
        endDate: null,
        daysInFuture: 7
      },
      limit: 10
    });
    vi.useRealTimers();
  });

  it('asks the seasonal shelf for the season getCurrentSeason reports', async () => {
    await run(event());

    const call = callsByDescription().get('seasonal data')!;
    expect(call[0]).toBe(getSeasonalAnime);
    expect(call[1]).toEqual({ season: 'SPRING_2026', limit: 14 });
  });

  it('asks for fourteen currently-publishing works', async () => {
    await run(event());

    const call = callsByDescription().get('publishing works')!;
    expect(call[0]).toBe(getCurrentlyPublishingWorks);
    expect(call[1]).toEqual({ limit: 14 });
  });

  it('builds the fetcher against the configured host and the request cookies', async () => {
    await run(event());

    expect(makeSSRFetcher).toHaveBeenCalledWith('https://api.test/graphql', 'cookie-header');
  });

  it('returns the season it asked for, so the client keys its query the same way', async () => {
    expect((await run(event())).currentSeason).toBe('SPRING_2026');
  });
});

describe('the payload handed to the page', () => {
  it('puts each answer under its own key', async () => {
    answers({
      'home data': { topRatedAnime: [{ id: 'top' }] },
      'currently airing data': AIRING_ONE,
      'seasonal data': { animeBySeasons: [{ id: 'season' }] },
      'publishing works': { works: { works: [{ id: 'work' }] } }
    });

    const result = await run(event());

    expect(result.homeData).toEqual({ topRatedAnime: [{ id: 'top' }] });
    expect(result.currentlyAiringData).toEqual(AIRING_ONE);
    expect(result.seasonalData).toEqual({ animeBySeasons: [{ id: 'season' }] });
    expect(result.publishingWorksData).toEqual({ works: { works: [{ id: 'work' }] } });
  });

  it('keeps the three other shelves when one request rejects', async () => {
    // Promise.allSettled, not Promise.all: a rejected shelf must not blank the page.
    fetchWithFallback.mockImplementation(
      async (_query: unknown, _vars: unknown, description: string) => {
        if (description === 'seasonal data') throw new Error('subgraph down');
        return { ok: description };
      }
    );

    const result = await run(event());

    expect(result.seasonalData).toBeNull();
    expect(result.homeData).toEqual({ ok: 'home data' });
    expect(result.currentlyAiringData).toEqual({ ok: 'currently airing data' });
    expect(result.publishingWorksData).toEqual({ ok: 'publishing works' });
  });

  it('carries a null answer through as null rather than inventing a shape', async () => {
    const result = await run(event());

    expect(result.homeData).toBeNull();
    expect(result.currentlyAiringData).toBeNull();
    expect(result.seasonalData).toBeNull();
    expect(result.publishingWorksData).toBeNull();
  });
});

describe('a gateway failure is indistinguishable from an empty homepage', () => {
  // FINDING, pinned as it stands rather than fixed. fetchWithFallback swallows
  // every error and answers null, and Promise.allSettled never rejects, so the
  // catch below it can only fire on a synchronous throw. A total outage
  // therefore renders as a homepage with nothing on it and ssrError null --
  // no error banner, no way for the reader to tell.
  it('reports no error when every shelf answered null', async () => {
    fetchWithFallback.mockResolvedValue(null);

    const result = await run(event());

    expect(result.ssrError).toBeNull();
    expect(result.homeData).toBeNull();
  });

  it('reports no error when every request rejected', async () => {
    fetchWithFallback.mockRejectedValue(new Error('gateway 502'));

    expect((await run(event())).ssrError).toBeNull();
  });

  it('only reaches its error message when a request throws synchronously', async () => {
    // The one path into the catch: the real fetchWithFallback is async and
    // never does this, which is why the message is unreachable in production.
    fetchWithFallback.mockImplementation(() => {
      throw new Error('client construction failed');
    });

    expect((await run(event())).ssrError).toBe('Failed to load data');
  });
});

describe('the banner preload hint', () => {
  it('points at the first airing show on the configured CDN', async () => {
    answers({ 'currently airing data': AIRING_ONE });

    expect((await run(event())).bannerImageUrl).toBe('https://cdn.test/weeb/banners/anime-1');
  });

  it('strips trailing slashes rather than emitting a doubled path', async () => {
    answers({ 'currently airing data': AIRING_ONE });

    const result = await run(
      event({
        locals: {
          auth: { isLoggedIn: false, hasAuthToken: false, hasRefreshToken: false },
          config: { graphql_host: 'https://api.test/graphql', cdn_url: 'https://cdn.test/weeb//' }
        }
      })
    );

    expect(result.bannerImageUrl).toBe('https://cdn.test/weeb/banners/anime-1');
  });

  it('encodes an id that would otherwise break the path', async () => {
    answers({ 'currently airing data': { getAiringAnimeAll: [{ id: 'a b/c' }] } });

    expect((await run(event())).bannerImageUrl).toBe('https://cdn.test/weeb/banners/a%20b%2Fc');
  });

  it('falls back to the production bucket when no cdn_url is configured', async () => {
    answers({ 'currently airing data': AIRING_ONE });

    const result = await run(
      event({
        locals: {
          auth: { isLoggedIn: false, hasAuthToken: false, hasRefreshToken: false },
          config: { graphql_host: 'https://api.test/graphql' }
        }
      })
    );

    expect(result.bannerImageUrl).toBe('https://cdn.weeb.vip/weeb/banners/anime-1');
  });

  it('is null when nothing is airing', async () => {
    answers({ 'currently airing data': { getAiringAnimeAll: [] } });

    expect((await run(event())).bannerImageUrl).toBeNull();
  });

  it('is null when the airing request answered null', async () => {
    expect((await run(event())).bannerImageUrl).toBeNull();
  });

  it('is null when the first show carries no id', async () => {
    answers({ 'currently airing data': { getAiringAnimeAll: [{ titleEn: 'no id' }] } });

    expect((await run(event())).bannerImageUrl).toBeNull();
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
