import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * /airing/calendar's server loader. It differs from /airing in exactly three
 * ways, and each one is load-bearing: the window is expressed as a start plus
 * daysInFuture rather than a start and an end, the limit is three hundred
 * because a month grid shows far more than a week's schedule, and the error
 * message is its own so the calendar's failure is distinguishable in logs.
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
const { getCurrentlyAiringWithDatesAndEpisodes } = await import(
  '$lib/services/api/graphql/queries'
);

function event(overrides: Record<string, unknown> = {}) {
  return {
    locals: {
      auth: { isLoggedIn: true, hasAuthToken: true, hasRefreshToken: true },
      config: { graphql_host: 'https://api.test/graphql' }
    },
    cookies: {},
    ...overrides
  } as any;
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

describe('the window it asks for', () => {
  it('is one request for the episode-bearing airing document', async () => {
    await run(event());

    expect(fetchWithFallback).toHaveBeenCalledTimes(1);
    expect(fetchWithFallback.mock.calls[0][0]).toBe(getCurrentlyAiringWithDatesAndEpisodes);
    expect(fetchWithFallback.mock.calls[0][2]).toBe('calendar data');
  });

  it('starts at midnight on the first of the month, not at the current instant', async () => {
    // A grid whose first cells are before "now" would come back empty for the
    // days already past, and those are exactly the cells a reader scrolls back to.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15, 12, 34, 56));

    await run(event());

    expect(fetchWithFallback.mock.calls[0][1].input.startDate).toEqual(new Date(2026, 3, 1));
  });

  it('spans 32 days forward, so a 31-day month is fully covered', async () => {
    await run(event());

    expect(fetchWithFallback.mock.calls[0][1].input.daysInFuture).toBe(32);
  });

  it('sends no endDate at all -- the span is expressed in days', async () => {
    await run(event());

    expect(fetchWithFallback.mock.calls[0][1].input).not.toHaveProperty('endDate');
  });

  it('asks for three hundred shows, since a month grid holds far more than a week', async () => {
    await run(event());

    expect(fetchWithFallback.mock.calls[0][1].limit).toBe(300);
  });

  it('builds the fetcher against the configured host and the request cookies', async () => {
    await run(event());

    expect(makeSSRFetcher).toHaveBeenCalledWith('https://api.test/graphql', 'cookie-header');
  });
});

describe('the payload handed to the page', () => {
  it('hands the whole response through as ssrData', async () => {
    const response = { getAiringAnimeAll: [{ id: 'a1', episodes: [{ id: 'e1' }] }] };
    fetchWithFallback.mockResolvedValue(response);

    const result = await run(event());

    expect(result.ssrData).toEqual(response);
    expect(result.ssrError).toBeNull();
  });

  it('does not report an error for a month with nothing airing in it', async () => {
    fetchWithFallback.mockResolvedValue({ getAiringAnimeAll: [] });

    expect((await run(event())).ssrError).toBeNull();
  });
});

describe('a gateway failure is told apart from an empty month', () => {
  // fetchWithFallback swallows the failure and answers null, so the loader
  // checks the answer: an outage must not render as a blank calendar with no
  // error to explain it.
  it('reports an error when the request answered null', async () => {
    fetchWithFallback.mockResolvedValue(null);

    const result = await run(event());

    expect(result.ssrData).toBeNull();
    expect(result.ssrError).toBe('Failed to load calendar data');
  });

  it('uses its own error message, distinguishable from the schedule page', async () => {
    fetchWithFallback.mockRejectedValue(new Error('gateway 502'));

    expect((await run(event())).ssrError).toBe('Failed to load calendar data');
  });

  it('keeps its own message on the null path too, not the schedule page"s', async () => {
    fetchWithFallback.mockResolvedValue(null);

    expect((await run(event())).ssrError).not.toBe('Failed to load data');
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
