import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSeasonalAnime } from '$lib/services/api/graphql/queries';

/**
 * /season/<SEASON_YEAR> is the only route whose parameter is an enum value the
 * API has to accept verbatim, so the rules worth pinning are the validation and
 * the fallback:
 *
 *  - anything not matching SEASON_YYYY exactly redirects to the current season
 *    rather than being normalised or passed through to the gateway,
 *  - the redirect target is computed from the clock, so it is pinned against a
 *    fixed system time at each seasonal boundary,
 *  - the display name is derived, not stored,
 *  - an expired token blanks the auth state handed to the client.
 *
 * `makeSSRFetcher` is mocked at the module seam; `publicAuth`/`loggedOutAuth`
 * are left real, so the test also pins that no token material rides the
 * payload into the page HTML.
 */

const fetchWithFallback =
  vi.fn<(query: unknown, variables: unknown, description: string) => Promise<unknown>>();
const wasTokenExpired = vi.fn<() => boolean>();
const makeSSRFetcher = vi.fn<(host: string, cookieHeader: string | null) => unknown>();

vi.mock('$lib/server/ssr-graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/server/ssr-graphql')>();
  return {
    ...actual,
    cookieHeaderFrom: () => 'cookie-header',
    makeSSRFetcher: (host: string, cookieHeader: string | null) => {
      makeSSRFetcher(host, cookieHeader);
      return { fetchWithFallback, wasTokenExpired };
    }
  };
});

const { load } = await import('./+page.server');

/**
 * `PageServerLoad` is typed as possibly returning void, so every success path
 * goes through this: it calls the real loader and narrows the payload.
 */
const run = async (event: Parameters<typeof load>[0]): Promise<Record<string, any>> =>
  (await load(event)) as Record<string, any>;

/** A token whose only readable claim is the expiry the client refresher needs. */
const TOKEN = `h.${btoa(JSON.stringify({ exp: 1_800_000_000 }))}.s`;

function args(season: string, auth: Record<string, unknown> = {}) {
  return {
    params: { season },
    locals: {
      auth: {
        isLoggedIn: true,
        hasAuthToken: true,
        hasRefreshToken: true,
        authToken: TOKEN,
        ...auth
      },
      config: { graphql_host: 'https://api.test/graphql' }
    },
    cookies: {}
  } as never;
}

beforeEach(() => {
  fetchWithFallback.mockReset();
  fetchWithFallback.mockResolvedValue({ seasonalAnime: [] });
  wasTokenExpired.mockReset();
  wasTokenExpired.mockReturnValue(false);
  makeSSRFetcher.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('which season parameters are accepted', () => {
  it.each(['WINTER_2025', 'SPRING_2025', 'SUMMER_2025', 'FALL_2025'])(
    'serves %s as given',
    async (season) => {
      const result = await run(args(season));

      expect(result.season).toBe(season);
      expect(fetchWithFallback).toHaveBeenCalledTimes(1);
    }
  );

  it('passes the parameter to the API verbatim, since it is an enum value', async () => {
    await run(args('SPRING_2025'));

    expect(fetchWithFallback).toHaveBeenCalledWith(
      getSeasonalAnime,
      { season: 'SPRING_2025', limit: 500 },
      'seasonal data'
    );
  });

  it('asks for the whole season in one request rather than paging it', async () => {
    await run(args('SPRING_2025'));

    const [, variables] = fetchWithFallback.mock.calls[0] as [unknown, { limit: number }, string];
    expect(variables.limit).toBe(500);
  });

  it('builds the fetcher against the configured host and the request cookies', async () => {
    await run(args('SPRING_2025'));

    expect(makeSSRFetcher).toHaveBeenCalledWith('https://api.test/graphql', 'cookie-header');
  });
});

describe('an unusable season parameter is not normalised, it redirects', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-05-15T12:00:00Z'));
  });

  it.each([
    ['spring_2025', 'lower case is not the enum value'],
    ['Spring_2025', 'mixed case is not either'],
    ['AUTUMN_2025', 'the season name the API does not use'],
    ['SPRING-2025', 'a hyphen instead of an underscore'],
    ['SPRING_25', 'a two-digit year'],
    ['SPRING_20255', 'a five-digit year'],
    ['SPRING', 'no year at all'],
    ['2025_SPRING', 'the halves the wrong way round'],
    ['SPRING_2025x', 'trailing junk'],
    ['', 'nothing']
  ])('redirects %o (%s)', async (season) => {
    await expect(load(args(season))).rejects.toMatchObject({
      status: 302,
      location: '/season/SPRING_2025'
    });
  });

  it('does not ask the gateway for a season it just rejected', async () => {
    await expect(load(args('nonsense'))).rejects.toMatchObject({ status: 302 });

    expect(fetchWithFallback).not.toHaveBeenCalled();
    expect(makeSSRFetcher).not.toHaveBeenCalled();
  });
});

describe('the current season the redirect lands on', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it.each([
    ['2025-01-15T12:00:00Z', 'WINTER_2025'],
    ['2025-03-15T12:00:00Z', 'WINTER_2025'],
    ['2025-04-15T12:00:00Z', 'SPRING_2025'],
    ['2025-06-15T12:00:00Z', 'SPRING_2025'],
    ['2025-07-15T12:00:00Z', 'SUMMER_2025'],
    ['2025-09-15T12:00:00Z', 'SUMMER_2025'],
    ['2025-10-15T12:00:00Z', 'FALL_2025'],
    ['2025-12-15T12:00:00Z', 'FALL_2025']
  ])('is %s -> %s', async (now, expected) => {
    // The calendar-quarter mapping: Jan-Mar winter, Apr-Jun spring, Jul-Sep
    // summer, Oct-Dec fall. December in particular stays in the CURRENT year's
    // fall; the loader carries a `month === 11` branch that would roll the year
    // forward, but the fall check above it means that branch is unreachable.
    vi.setSystemTime(new Date(now));

    await expect(load(args('bad'))).rejects.toMatchObject({
      location: `/season/${expected}`
    });
  });
});

describe('the display name', () => {
  it.each([
    ['WINTER_2025', 'Winter 2025'],
    ['SPRING_2026', 'Spring 2026'],
    ['SUMMER_1999', 'Summer 1999'],
    ['FALL_2030', 'Fall 2030']
  ])('renders %s as %o', async (season, expected) => {
    expect((await run(args(season))).displayName).toBe(expected);
  });
});

describe('the payload', () => {
  it('hands the seasonal response through untouched', async () => {
    const payload = { seasonalAnime: [{ id: 'a1' }, { id: 'a2' }] };
    fetchWithFallback.mockResolvedValue(payload);

    const result = await run(args('SPRING_2025'));

    expect(result.seasonalData).toBe(payload);
  });

  it('returns exactly the six fields the page reads', async () => {
    expect(Object.keys(await run(args('SPRING_2025'))).sort()).toEqual([
      'auth',
      'displayName',
      'isTokenExpired',
      'seasonalData',
      'season',
      'ssrError'
    ].sort());
  });
});

describe('the auth state handed to the client', () => {
  it('is the public view of locals.auth on a normal render', async () => {
    const result = await run(args('SPRING_2025'));

    expect(result.auth).toEqual({
      isLoggedIn: true,
      hasAuthToken: true,
      hasRefreshToken: true,
      authTokenExpiresAt: 1_800_000_000_000
    });
    expect(result.isTokenExpired).toBe(false);
  });

  it('never serialises the token itself into the page', async () => {
    expect(JSON.stringify((await run(args('SPRING_2025'))).auth)).not.toContain(TOKEN);
  });

  it('is blanked out when SSR found the token expired', async () => {
    wasTokenExpired.mockReturnValue(true);

    const result = await run(args('SPRING_2025'));

    expect(result.auth).toEqual({
      isLoggedIn: false,
      hasAuthToken: false,
      hasRefreshToken: false,
      authTokenExpiresAt: null
    });
    expect(result.isTokenExpired).toBe(true);
  });

  it('reads the expiry flag after the fetch, so a mid-fetch expiry is caught', async () => {
    // wasTokenExpired only becomes true once fetchWithFallback has tried and
    // fallen back; reading it earlier would always report false.
    let expired = false;
    wasTokenExpired.mockImplementation(() => expired);
    fetchWithFallback.mockImplementation(async () => {
      expired = true;
      return null;
    });

    expect((await run(args('SPRING_2025'))).isTokenExpired).toBe(true);
  });
});

describe('what happens when the season data does not arrive', () => {
  it('reports an error only when the fetcher actually threw', async () => {
    fetchWithFallback.mockRejectedValue(new Error('boom'));

    const result = await run(args('SPRING_2025'));

    expect(result.ssrError).toBe('Failed to load data');
    expect(result.seasonalData).toBeNull();
  });

  it('leaves ssrError null for a null answer -- see the note below', async () => {
    // BUG (pinned as current behaviour, not fixed): makeSSRFetcher's
    // fetchWithFallback swallows every failure and RETURNS null rather than
    // throwing, so the try/catch above almost never fires. A gateway outage
    // therefore reaches the page as `seasonalData: null, ssrError: null` and
    // renders as "no anime this season" instead of as a recoverable error.
    // Compare loadWorksBrowse, which explicitly checks the answer for null.
    fetchWithFallback.mockResolvedValue(null);

    const result = await run(args('SPRING_2025'));

    expect(result.seasonalData).toBeNull();
    expect(result.ssrError).toBeNull();
  });

  it('leaves ssrError null for a response missing the seasonalAnime field', async () => {
    fetchWithFallback.mockResolvedValue({ somethingElse: true });

    expect((await run(args('SPRING_2025'))).ssrError).toBeNull();
  });

  it('does not report an error for a genuinely empty season', async () => {
    fetchWithFallback.mockResolvedValue({ seasonalAnime: [] });

    const result = await run(args('SPRING_2025'));

    expect(result.ssrError).toBeNull();
    expect(result.seasonalData).toEqual({ seasonalAnime: [] });
  });

  it('still names the season when the fetch failed', async () => {
    fetchWithFallback.mockRejectedValue(new Error('boom'));

    const result = await run(args('SPRING_2025'));

    expect(result.season).toBe('SPRING_2025');
    expect(result.displayName).toBe('Spring 2025');
  });
});
