import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * `loadWorksBrowse` is the shared loader behind /manga and /light-novels. The
 * rules worth pinning are the ones a reader cannot see went wrong:
 *
 *  - a failed request must not render as an empty catalogue,
 *  - the URL counts pages from 1 and the wire counts from 0,
 *  - an unrecognised `?sort=` falls back to the shelf view rather than asking
 *    the API for a sort it does not have.
 *
 * The GraphQL layer is mocked at the module seam (`./ssr-graphql`) so nothing
 * is fetched; `fetchWithFallback` is a spy whose calls ARE the assertion about
 * what was asked for.
 */

const fetchWithFallback = vi.fn();
const wasTokenExpired = vi.fn(() => false);
const makeSSRFetcher = vi.fn(() => ({ fetchWithFallback, wasTokenExpired }));

vi.mock('./ssr-graphql', () => ({
  makeSSRFetcher: (...args: unknown[]) => (makeSSRFetcher as any)(...args),
  cookieHeaderFrom: () => 'cookie-header',
  publicAuth: (auth: any) => ({ isLoggedIn: !!auth?.isLoggedIn, source: 'publicAuth' }),
  loggedOutAuth: () => ({ isLoggedIn: false, source: 'loggedOutAuth' })
}));

const { loadWorksBrowse, PER_PAGE, SHELF_SIZE } = await import('./works-browse');

const MANGA = ['MANGA', 'MANHWA'] as const;

/** The loader's four arguments, with only the URL usually varying. */
function args(search: string, overrides: Record<string, unknown> = {}) {
  return {
    types: MANGA,
    url: new URL(`https://weeb.vip/manga${search}`),
    locals: {
      auth: { isLoggedIn: true, hasAuthToken: true, hasRefreshToken: true },
      config: { graphql_host: 'https://api.test/graphql' }
    } as any,
    cookies: {} as any,
    ...overrides
  };
}

/** One page of works, as the paged branch reads it. */
function pagedResult(total: number, works: unknown[] = [{ id: 'w1' }]) {
  return { works: { works, total } };
}

/** The three shelf aliases, as the overview branch reads them. */
function shelvesResult(overrides: Record<string, unknown> = {}) {
  return {
    popular: { works: [{ id: 'p1' }], total: 500 },
    rated: { works: [{ id: 'r1' }], total: 500 },
    newest: { works: [{ id: 'n1' }], total: 500 },
    ...overrides
  };
}

beforeEach(() => {
  fetchWithFallback.mockReset();
  wasTokenExpired.mockReset();
  wasTokenExpired.mockReturnValue(false);
  makeSSRFetcher.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('which view the URL selects', () => {
  it('is the shelf view with no sort', async () => {
    fetchWithFallback.mockResolvedValue(shelvesResult());

    const result = await loadWorksBrowse(args(''));

    expect(result.sort).toBeNull();
    expect(result.works).toEqual([]);
    expect(result.shelves).toHaveLength(3);
  });

  it('is the paged view for a sort the API knows', async () => {
    fetchWithFallback.mockResolvedValue(pagedResult(48));

    const result = await loadWorksBrowse(args('?sort=SCORE'));

    expect(result.sort).toBe('SCORE');
    expect(result.shelves).toBeNull();
    expect(result.works).toEqual([{ id: 'w1' }]);
  });

  it('ignores a sort the API does not offer rather than asking for it', async () => {
    // TITLE is deliberately absent from WORK_SHELVES; passing it through would
    // send the API a sortBy it does not implement.
    fetchWithFallback.mockResolvedValue(shelvesResult());

    const result = await loadWorksBrowse(args('?sort=TITLE'));

    expect(result.sort).toBeNull();
    expect(result.shelves).not.toBeNull();
    expect(JSON.stringify(fetchWithFallback.mock.calls[0][1])).not.toContain('TITLE');
  });

  it('ignores an empty sort parameter', async () => {
    fetchWithFallback.mockResolvedValue(shelvesResult());

    expect((await loadWorksBrowse(args('?sort='))).sort).toBeNull();
  });
});

describe('paging', () => {
  it('sends the wire the zero-based page for the reader-facing page 1', async () => {
    fetchWithFallback.mockResolvedValue(pagedResult(100));

    const result = await loadWorksBrowse(args('?sort=SCORE'));

    expect(fetchWithFallback.mock.calls[0][1].input).toMatchObject({
      page: 0,
      perPage: PER_PAGE,
      sortBy: 'SCORE'
    });
    expect(result.page).toBe(1);
  });

  it('subtracts one from every later page', async () => {
    fetchWithFallback.mockResolvedValue(pagedResult(100));

    const result = await loadWorksBrowse(args('?sort=SCORE&page=7'));

    expect(fetchWithFallback.mock.calls[0][1].input.page).toBe(6);
    expect(result.page).toBe(7);
  });

  it.each(['0', '-3', 'abc', 'NaN', ''])(
    'falls back to page 1 for the unusable page value %o',
    async (value) => {
      fetchWithFallback.mockResolvedValue(pagedResult(100));

      const result = await loadWorksBrowse(args(`?sort=SCORE&page=${value}`));

      expect(result.page).toBe(1);
      expect(fetchWithFallback.mock.calls[0][1].input.page).toBe(0);
    }
  );

  it('floors a fractional page rather than sending it through', async () => {
    fetchWithFallback.mockResolvedValue(pagedResult(100));

    const result = await loadWorksBrowse(args('?sort=SCORE&page=3.9'));

    expect(result.page).toBe(3);
    expect(fetchWithFallback.mock.calls[0][1].input.page).toBe(2);
  });

  it('rounds the page count up, so a partial last page still exists', async () => {
    fetchWithFallback.mockResolvedValue(pagedResult(PER_PAGE + 1));

    expect((await loadWorksBrowse(args('?sort=SCORE'))).totalPages).toBe(2);
  });

  it('is exact when the total divides evenly', async () => {
    fetchWithFallback.mockResolvedValue(pagedResult(PER_PAGE * 3));

    expect((await loadWorksBrowse(args('?sort=SCORE'))).totalPages).toBe(3);
  });

  it('has no pages at all for an empty shelf', async () => {
    fetchWithFallback.mockResolvedValue(pagedResult(0, []));

    const result = await loadWorksBrowse(args('?sort=SCORE'));

    expect(result.totalPages).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe('a failure is not an empty catalogue', () => {
  it('reports an error when the paged query answered null', async () => {
    // fetchWithFallback swallows the error and returns null. Without the
    // explicit check the page would render "nothing here" for an outage.
    fetchWithFallback.mockResolvedValue(null);

    const result = await loadWorksBrowse(args('?sort=SCORE'));

    expect(result.ssrError).toBe('Failed to load');
    expect(result.works).toEqual([]);
  });

  it('reports an error when the response carried no works field', async () => {
    fetchWithFallback.mockResolvedValue({ somethingElse: true });

    expect((await loadWorksBrowse(args('?sort=SCORE'))).ssrError).toBe('Failed to load');
  });

  it('reports an error when the fetcher threw', async () => {
    fetchWithFallback.mockRejectedValue(new Error('boom'));

    const result = await loadWorksBrowse(args('?sort=SCORE'));

    expect(result.ssrError).toBe('Failed to load');
    expect(result.total).toBe(0);
  });

  it('does NOT report an error for a genuinely empty page of works', async () => {
    fetchWithFallback.mockResolvedValue({ works: { works: [], total: 0 } });

    expect((await loadWorksBrowse(args('?sort=SCORE'))).ssrError).toBeNull();
  });

  it('reports an error when the shelf query answered null', async () => {
    fetchWithFallback.mockResolvedValue(null);

    const result = await loadWorksBrowse(args(''));

    expect(result.ssrError).toBe('Failed to load');
    expect(result.shelves?.every((shelf) => shelf.works.length === 0)).toBe(true);
  });

  it('treats a partial shelf response — one alias missing — as a failure', async () => {
    // Checked against `popular` rather than the wrapper: a response missing an
    // alias is a schema mismatch, and it used to render as a short page.
    fetchWithFallback.mockResolvedValue({ rated: { works: [{ id: 'r1' }], total: 5 } });

    expect((await loadWorksBrowse(args(''))).ssrError).toBe('Failed to load');
  });

  it('does NOT report an error for shelves that answered with nothing on them', async () => {
    fetchWithFallback.mockResolvedValue({
      popular: { works: [], total: 0 },
      rated: { works: [], total: 0 },
      newest: { works: [], total: 0 }
    });

    const result = await loadWorksBrowse(args(''));

    expect(result.ssrError).toBeNull();
    expect(result.shelves?.map((shelf) => shelf.works)).toEqual([[], [], []]);
  });

  it('reports an error when the shelf fetch threw', async () => {
    fetchWithFallback.mockRejectedValue(new Error('boom'));

    expect((await loadWorksBrowse(args(''))).ssrError).toBe('Failed to load');
  });
});

describe('the shelves', () => {
  it('is one shelf per WORK_SHELVES entry, in order, with its label', async () => {
    fetchWithFallback.mockResolvedValue(shelvesResult());

    const result = await loadWorksBrowse(args(''));

    expect(result.shelves).toEqual([
      { sort: 'POPULARITY', label: 'Most popular', works: [{ id: 'p1' }] },
      { sort: 'SCORE', label: 'Highest rated', works: [{ id: 'r1' }] },
      { sort: 'NEWEST', label: 'Newest', works: [{ id: 'n1' }] }
    ]);
  });

  it('asks for all three sorts in one round trip, at the shelf size', async () => {
    fetchWithFallback.mockResolvedValue(shelvesResult());

    await loadWorksBrowse(args(''));

    expect(fetchWithFallback).toHaveBeenCalledTimes(1);
    const variables = fetchWithFallback.mock.calls[0][1];
    expect(variables.popular).toMatchObject({ page: 0, perPage: SHELF_SIZE, sortBy: 'POPULARITY' });
    expect(variables.rated).toMatchObject({ sortBy: 'SCORE' });
    expect(variables.newest).toMatchObject({ sortBy: 'NEWEST' });
  });

  it('takes the scope total from the first shelf rather than a fourth query', async () => {
    fetchWithFallback.mockResolvedValue(shelvesResult({ popular: { works: [], total: 53_000 } }));

    expect((await loadWorksBrowse(args(''))).total).toBe(53_000);
  });

  it('is never paged: page 1, no total pages', async () => {
    fetchWithFallback.mockResolvedValue(shelvesResult());

    const result = await loadWorksBrowse(args('?page=4'));

    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(0);
    expect(result.perPage).toBe(SHELF_SIZE);
  });
});

describe('the scope each page asks for', () => {
  it('sends the included kinds as a plain array', async () => {
    fetchWithFallback.mockResolvedValue(shelvesResult());

    await loadWorksBrowse(args(''));

    expect(fetchWithFallback.mock.calls[0][1].popular).toMatchObject({
      types: ['MANGA', 'MANHWA']
    });
  });

  it('sends excludeTypes instead for the "everything else" page', async () => {
    fetchWithFallback.mockResolvedValue(shelvesResult());

    await loadWorksBrowse(
      args('', { types: undefined, excludeTypes: ['MANGA', 'MANHWA'] as const })
    );

    const scope = fetchWithFallback.mock.calls[0][1].popular;
    expect(scope.excludeTypes).toEqual(['MANGA', 'MANHWA']);
    expect(scope).not.toHaveProperty('types');
  });

  it('sends neither key when the page scopes to every kind', async () => {
    fetchWithFallback.mockResolvedValue(shelvesResult());

    await loadWorksBrowse(args('', { types: undefined }));

    const scope = fetchWithFallback.mock.calls[0][1].popular;
    expect(scope).not.toHaveProperty('types');
    expect(scope).not.toHaveProperty('excludeTypes');
  });

  it('copies the kinds rather than passing the caller\'s readonly array through', async () => {
    fetchWithFallback.mockResolvedValue(shelvesResult());

    await loadWorksBrowse(args(''));

    expect(fetchWithFallback.mock.calls[0][1].popular.types).not.toBe(MANGA);
  });
});

describe('the auth state handed to the client', () => {
  it('is the public view of locals.auth on a normal render', async () => {
    fetchWithFallback.mockResolvedValue(shelvesResult());

    expect((await loadWorksBrowse(args(''))).auth).toEqual({
      isLoggedIn: true,
      source: 'publicAuth'
    });
  });

  it('is blanked out when SSR found the token expired — paged view', async () => {
    fetchWithFallback.mockResolvedValue(pagedResult(10));
    wasTokenExpired.mockReturnValue(true);

    expect((await loadWorksBrowse(args('?sort=SCORE'))).auth).toEqual({
      isLoggedIn: false,
      source: 'loggedOutAuth'
    });
  });

  it('is blanked out when SSR found the token expired — shelf view', async () => {
    fetchWithFallback.mockResolvedValue(shelvesResult());
    wasTokenExpired.mockReturnValue(true);

    expect((await loadWorksBrowse(args(''))).auth).toEqual({
      isLoggedIn: false,
      source: 'loggedOutAuth'
    });
  });

  it('builds the fetcher against the configured host and the request cookies', async () => {
    fetchWithFallback.mockResolvedValue(shelvesResult());

    await loadWorksBrowse(args(''));

    expect(makeSSRFetcher).toHaveBeenCalledWith('https://api.test/graphql', 'cookie-header');
  });
});
