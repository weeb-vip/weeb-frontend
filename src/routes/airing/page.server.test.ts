import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * /airing's server loader. One request, whose window is the load-bearing part:
 * the schedule view reads the next seven days out of it and the calendar view
 * reads the month, so a window that starts late silently empties the top of
 * the schedule.
 *
 * The GraphQL layer is mocked at `$lib/server/ssr-graphql`; nothing is fetched.
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
    expect(fetchWithFallback.mock.calls[0][2]).toBe('currently airing data');
  });

  it('runs from the first of this month to the last day of next month', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15, 12, 0, 0)); // 15 April

    await run(event());

    expect(fetchWithFallback.mock.calls[0][1]).toEqual({
      input: {
        startDate: new Date(2026, 3, 1),
        // Day 0 of month+2 is the last day of month+1: 31 May.
        endDate: new Date(2026, 4, 31)
      },
      limit: 100
    });
  });

  it('rolls the end of the window into the next year in December', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 20, 9, 0, 0)); // 20 December

    await run(event());

    const { input } = fetchWithFallback.mock.calls[0][1];
    expect(input.startDate).toEqual(new Date(2026, 11, 1));
    expect(input.endDate).toEqual(new Date(2027, 0, 31));
  });

  it('asks for a hundred shows, enough for a month of schedule', async () => {
    await run(event());

    expect(fetchWithFallback.mock.calls[0][1].limit).toBe(100);
  });

  it('builds the fetcher against the configured host and the request cookies', async () => {
    await run(event());

    expect(makeSSRFetcher).toHaveBeenCalledWith('https://api.test/graphql', 'cookie-header');
  });
});

describe('the payload handed to the page', () => {
  it('hands the whole response through as ssrData', async () => {
    const response = { getAiringAnimeAll: [{ id: 'a1', episodes: [] }] };
    fetchWithFallback.mockResolvedValue(response);

    const result = await run(event());

    expect(result.ssrData).toEqual(response);
    expect(result.ssrError).toBeNull();
  });

  it('does not report an error for a genuinely empty schedule', async () => {
    fetchWithFallback.mockResolvedValue({ getAiringAnimeAll: [] });

    const result = await run(event());

    expect(result.ssrData).toEqual({ getAiringAnimeAll: [] });
    expect(result.ssrError).toBeNull();
  });
});

describe('a gateway failure is told apart from nothing airing', () => {
  // fetchWithFallback answers null on any failure and never throws, so the
  // loader checks the answer rather than relying on its catch: an outage has to
  // reach the page as an error, not as an empty schedule.
  it('reports an error when the request answered null', async () => {
    fetchWithFallback.mockResolvedValue(null);

    const result = await run(event());

    expect(result.ssrData).toBeNull();
    expect(result.ssrError).toBe('Failed to load data');
  });

  it('reports an error when the request throws too', async () => {
    fetchWithFallback.mockRejectedValue(new Error('gateway 502'));

    const result = await run(event());

    expect(result.ssrError).toBe('Failed to load data');
    expect(result.ssrData).toBeNull();
  });

  it('does not report an error for a response with an empty list in it', async () => {
    // The distinction the check turns on: a quiet week still answers with a
    // response object, and must keep rendering as a quiet week.
    fetchWithFallback.mockResolvedValue({ getAiringAnimeAll: [] });

    expect((await run(event())).ssrError).toBeNull();
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
