import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The watchlist page's server loader. The URL names the medium, the status and
 * the page, and the server has to resolve all three the same way the client
 * will -- otherwise SSR renders one shelf, the client hydrates into another and
 * refetches immediately, which is the whole point of rendering it on the server.
 *
 * So the rules pinned here are the resolution rules (what an unknown, empty or
 * cross-medium value falls back to), which query the active medium sends, and
 * the zero-based page the components read.
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
const { queryUserAnimes, queryUserWorks, queryUserAnimeStatusCounts, queryUserWorkStatusCounts } =
  await import('$lib/services/api/graphql/queries');

const SSR_PER_PAGE = 24;

function event(search = '', loggedIn = true) {
  return {
    url: new URL(`https://weeb.vip/profile/anime${search}`),
    locals: {
      auth: { isLoggedIn: loggedIn, hasAuthToken: loggedIn, hasRefreshToken: loggedIn },
      config: { graphql_host: 'https://api.test/graphql' }
    },
    cookies: {}
  } as any;
}

/** The one list request, whichever medium sent it. */
function listCall() {
  return fetchWithFallback.mock.calls.find(
    (call: any[]) => call[2] === 'watchlist' || call[2] === 'reading list'
  )!;
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
  vi.restoreAllMocks();
});

describe('which medium the URL selects', () => {
  it('is anime when the URL names none', async () => {
    expect((await run(event())).ssr.medium).toBe('anime');
  });

  it('is manga only for exactly "manga"', async () => {
    expect((await run(event('?medium=manga'))).ssr.medium).toBe('manga');
  });

  it.each(['MANGA', 'Manga', 'manhwa', 'novels', ''])(
    'falls back to anime for the medium %o',
    async (value) => {
      expect((await run(event(`?medium=${value}`))).ssr.medium).toBe('anime');
    }
  );
});

describe('which status the URL selects', () => {
  it('opens anime on plan-to-watch when the URL names no status', async () => {
    expect((await run(event())).ssr.status).toBe('PLANTOWATCH');
  });

  it('opens manga on reading when the URL names no status', async () => {
    expect((await run(event('?medium=manga'))).ssr.status).toBe('READING');
  });

  it('honours a status the medium actually has', async () => {
    expect((await run(event('?status=WATCHING'))).ssr.status).toBe('WATCHING');
    expect((await run(event('?medium=manga&status=PLANTOREAD'))).ssr.status).toBe('PLANTOREAD');
  });

  it('ignores a status belonging to the other medium', async () => {
    // READING is a work status; asking the anime API for it would be a schema error.
    expect((await run(event('?status=READING'))).ssr.status).toBe('PLANTOWATCH');
    expect((await run(event('?medium=manga&status=WATCHING'))).ssr.status).toBe('READING');
  });

  it('keeps a status the two media share', async () => {
    expect((await run(event('?status=COMPLETED'))).ssr.status).toBe('COMPLETED');
    expect((await run(event('?medium=manga&status=COMPLETED'))).ssr.status).toBe('COMPLETED');
  });

  it.each(['', 'watching', 'BOGUS', 'null'])(
    'falls back to the default for the unusable status %o',
    async (value) => {
      expect((await run(event(`?status=${value}`))).ssr.status).toBe('PLANTOWATCH');
    }
  );
});

describe('paging', () => {
  it('opens on the first page, which the wire counts from one', async () => {
    const result = await run(event());

    expect(result.ssr.page).toBe(0);
    expect(listCall()[1].input.page).toBe(1);
  });

  it('sends the reader-facing page to the wire and hands the components one less', async () => {
    const result = await run(event('?page=4'));

    expect(listCall()[1].input.page).toBe(4);
    expect(result.ssr.page).toBe(3);
  });

  it.each(['0', '-2', 'abc', '', 'NaN'])(
    'falls back to page one for the unusable page value %o',
    async (value) => {
      const result = await run(event(`?page=${value}`));

      expect(result.ssr.page).toBe(0);
      expect(listCall()[1].input.page).toBe(1);
    }
  );

  it('truncates a fractional page rather than sending it through', async () => {
    const result = await run(event('?page=3.9'));

    expect(listCall()[1].input.page).toBe(3);
    expect(result.ssr.page).toBe(2);
  });

  it('reports the page size the components should render', async () => {
    expect((await run(event())).ssr.perPage).toBe(SSR_PER_PAGE);
  });
});

describe('what a signed-in visit fetches', () => {
  it('is both count queries plus the active medium\'s list', async () => {
    await run(event());

    expect(fetchWithFallback).toHaveBeenCalledTimes(3);
    expect(fetchWithFallback.mock.calls.map((call: any[]) => call[2])).toEqual([
      'anime status counts',
      'work status counts',
      'watchlist'
    ]);
  });

  it('fetches both media\'s counts, so the Anime | Manga switch is instant', async () => {
    await run(event('?medium=manga'));

    expect(fetchWithFallback.mock.calls[0][0]).toBe(queryUserAnimeStatusCounts);
    expect(fetchWithFallback.mock.calls[1][0]).toBe(queryUserWorkStatusCounts);
  });

  it('sends the anime list query for the anime medium', async () => {
    await run(event('?status=WATCHING&page=2'));

    expect(listCall()[0]).toBe(queryUserAnimes);
    expect(listCall()[1]).toEqual({
      input: { status: 'WATCHING', limit: SSR_PER_PAGE, page: 2 }
    });
  });

  it('sends the works list query for the manga medium', async () => {
    await run(event('?medium=manga&status=COMPLETED'));

    expect(listCall()[0]).toBe(queryUserWorks);
    expect(listCall()[1]).toEqual({
      input: { status: 'COMPLETED', limit: SSR_PER_PAGE, page: 1 }
    });
    expect(listCall()[2]).toBe('reading list');
  });

  it('builds the fetcher against the configured host and the request cookies', async () => {
    await run(event());

    expect(makeSSRFetcher).toHaveBeenCalledWith('https://api.test/graphql', 'cookie-header');
  });
});

describe('what a signed-out visit does', () => {
  it('fetches nothing -- the layout guard bounces it to login anyway', async () => {
    await run(event('', false));

    expect(fetchWithFallback).not.toHaveBeenCalled();
  });

  it('still resolves the shell state from the URL', async () => {
    const result = await run(event('?medium=manga&status=PLANTOREAD&page=3', false));

    expect(result.ssr).toEqual({
      medium: 'manga',
      status: 'PLANTOREAD',
      page: 2,
      perPage: SSR_PER_PAGE,
      loggedIn: false
    });
  });

  it('returns no auth block at all, unlike a signed-in visit', async () => {
    const result = await run(event('', false));

    expect(result).not.toHaveProperty('auth');
    expect(result).not.toHaveProperty('isTokenExpired');
  });
});

describe('the lists handed to the client', () => {
  it('unwraps each answer to what its own queryFn returns', async () => {
    answers({
      'anime status counts': { UserAnimeStatusCounts: { WATCHING: 12 } },
      'work status counts': { UserWorkStatusCounts: { READING: 3 } },
      watchlist: { UserAnimes: { animes: [{ id: 'w1' }], total: 12 } }
    });

    const result = await run(event());

    expect(result.ssr.animeCounts).toEqual({ WATCHING: 12 });
    expect(result.ssr.workCounts).toEqual({ READING: 3 });
    expect(result.ssr.animeList).toEqual({ animes: [{ id: 'w1' }], total: 12 });
  });

  it('leaves the inactive medium\'s list null rather than half-filled', async () => {
    answers({ watchlist: { UserAnimes: { animes: [{ id: 'w1' }] } } });

    const result = await run(event());

    expect(result.ssr.workList).toBeNull();
    expect(result.ssr.animeList).not.toBeNull();
  });

  it('fills the work list and not the anime list on the manga medium', async () => {
    answers({ 'reading list': { UserWorks: { works: [{ id: 'r1' }], total: 3 } } });

    const result = await run(event('?medium=manga'));

    expect(result.ssr.workList).toEqual({ works: [{ id: 'r1' }], total: 3 });
    expect(result.ssr.animeList).toBeNull();
  });

  // FINDING, pinned as it stands: there is no ssrError on this loader, so a
  // failed list request and an empty shelf are the same payload.
  it('is null everywhere when every request answered null', async () => {
    fetchWithFallback.mockResolvedValue(null);

    const result = await run(event());

    expect(result.ssr.animeCounts).toBeNull();
    expect(result.ssr.workCounts).toBeNull();
    expect(result.ssr.animeList).toBeNull();
    expect(result).not.toHaveProperty('ssrError');
  });

  it('is null for a response that carried no wrapper field', async () => {
    answers({ watchlist: { somethingElse: true } });

    expect((await run(event())).ssr.animeList).toBeNull();
  });

  it('keeps a genuinely empty shelf as an empty list', async () => {
    answers({ watchlist: { UserAnimes: { animes: [], total: 0 } } });

    expect((await run(event())).ssr.animeList).toEqual({ animes: [], total: 0 });
  });
});

describe('the auth state handed to the client', () => {
  it('is the public view of locals.auth on a normal render', async () => {
    const result = await run(event());

    expect(result.auth).toEqual({ isLoggedIn: true, source: 'publicAuth' });
    expect(result.isTokenExpired).toBe(false);
    expect(result.ssr.loggedIn).toBe(true);
  });

  it('blanks the auth state and the loggedIn flag when the token turned out expired', async () => {
    // The cookie said signed in, so the queries were sent; SSR then found the
    // token bad, and the client must not render as if it were still valid.
    wasTokenExpired.mockReturnValue(true);

    const result = await run(event());

    expect(result.auth).toEqual({ isLoggedIn: false, source: 'loggedOutAuth' });
    expect(result.isTokenExpired).toBe(true);
    expect(result.ssr.loggedIn).toBe(false);
  });
});
