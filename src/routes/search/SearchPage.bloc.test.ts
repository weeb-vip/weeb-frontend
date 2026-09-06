import { describe, it, expect, vi, afterEach } from 'vitest';
import { writable, type Readable } from 'svelte/store';
import {
  INITIAL_GENRE_COUNT,
  PAGE_SIZE_OPTIONS,
  SearchPageBloc,
  type CatalogSearchRequest,
  type CatalogSearchResponse,
  type RoutePort,
} from './SearchPage.bloc.svelte';
import type { GenreFacet } from './SearchPage.results';

/**
 * The /search bloc: how the pure helpers in `SearchPage.urlState.ts` and
 * `SearchPage.results.ts` are wired together, and the state that only lives on
 * the class. Those two modules have their own suites -- nothing here re-tests
 * `readSearchUrl`, `toggleGenre`, `normalizeHit` or `filterAndSortHits` as
 * functions; what is pinned here is which of them the bloc reaches for, with
 * what, and what it does with the answer.
 *
 * Three rules earned their tests the hard way:
 *
 *  - the query and the genre are URL-backed, so a handler that assigned them
 *    directly raced the navigation and lost;
 *  - the genre is one value, so a second chip must *replace* the first rather
 *    than being silently dropped on the next navigation;
 *  - a superseded in-flight search must never land on top of a newer one.
 */

/* ── Harness ─────────────────────────────────────────────────────────────── */

type UrlValue = { pathname: string; search: string };

const EMPTY_RESPONSE: CatalogSearchResponse = { hits: [], total: 0, works: [] };

function response(partial: Partial<CatalogSearchResponse> = {}): CatalogSearchResponse {
  return { ...EMPTY_RESPONSE, ...partial };
}

/** One Algolia record, in the shape the anime index actually stores. */
function hit(id: string, extra: Record<string, any> = {}) {
  return { id, title_en: `Title ${id}`, url_slug: `slug-${id}`, ...extra };
}

/** A promise this test resolves by hand, so two searches can be interleaved. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let every already-settled microtask (and the odd macrotask) drain. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

interface SetupOptions {
  /** The search string the URL starts on. */
  search?: string;
  /** The pathname the URL starts on. */
  pathname?: string;
  /** The pathname the bloc was told it lives at. */
  blocPathname?: string;
  respond?: (request: CatalogSearchRequest) => Promise<CatalogSearchResponse>;
  genres?: () => Promise<GenreFacet[]>;
  list?: () => Promise<Map<string, string>>;
}

/**
 * The bloc with every port stubbed. `replace` writes straight back into the URL
 * store, which is the whole navigation cycle: the caller's effect is modelled by
 * the test calling `syncFromUrl()` itself, so the ordering stays visible.
 */
function setup(options: SetupOptions = {}) {
  const store = writable<UrlValue>({
    pathname: options.pathname ?? '/search',
    search: options.search ?? '',
  });

  const subscribed = vi.fn();
  const replace = vi.fn((next: string) => {
    store.update((current) => ({ ...current, search: next }));
  });

  const url: Readable<UrlValue> = {
    subscribe: (run) => {
      subscribed();
      return store.subscribe(run);
    },
  };
  const route: RoutePort = { url, replace };

  const search = vi.fn(options.respond ?? (async () => EMPTY_RESPONSE));
  const genreFacets = vi.fn(options.genres ?? (async () => [] as GenreFacet[]));
  const load = vi.fn(options.list ?? (async () => new Map<string, string>()));

  const bloc = new SearchPageBloc({
    search: { search, genreFacets },
    userList: { load },
    route,
    pathname: options.blocPathname ?? '/search',
  });

  return {
    bloc,
    replace,
    search,
    genreFacets,
    load,
    subscribed,
    /** Move the address bar without going through the bloc. */
    navigate: (next: Partial<UrlValue>) => store.update((current) => ({ ...current, ...next })),
    lastRequest: () => search.mock.calls.at(-1)![0] as CatalogSearchRequest,
  };
}

/** A bloc already showing results for `?query=naruto`. */
async function searched(partial: Partial<CatalogSearchResponse> = {}, search = '?query=naruto') {
  const harness = setup({ search, respond: async () => response(partial) });
  await harness.bloc.init();
  return harness;
}

function genreList(count: number): GenreFacet[] {
  return Array.from({ length: count }, (_, i) => ({ name: `Genre ${i}`, count: 100 - i }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

/* ── The three state layers ──────────────────────────────────────────────── */

describe('the URL-backed layer', () => {
  it('takes the committed query and genre from the URL, not from a handler', async () => {
    const { bloc } = await searched({}, '?query=naruto&genre=Action');

    expect(bloc.committedQuery).toBe('naruto');
    expect(bloc.selectedGenre).toBe('Action');
  });

  it('seeds the draft box from the committed query so the field is not blank', async () => {
    const { bloc } = await searched({}, '?query=naruto');

    expect(bloc.draftQuery).toBe('naruto');
  });

  it('does not commit a submitted query until the navigation lands', async () => {
    const { bloc, replace } = await searched();

    bloc.draftQuery = 'bleach';
    bloc.submit();

    // The handler wrote a URL and nothing else; the state is still the old one.
    expect(replace).toHaveBeenCalledWith('?query=bleach');
    expect(bloc.committedQuery).toBe('naruto');

    bloc.syncFromUrl();
    expect(bloc.committedQuery).toBe('bleach');
  });

  it('treats a blank submission as a no-op rather than a navigation', async () => {
    const { bloc, replace } = await searched();

    bloc.draftQuery = '   ';
    bloc.submit();

    expect(replace).not.toHaveBeenCalled();
    expect(bloc.committedQuery).toBe('naruto');
  });
});

describe('the local layer', () => {
  it('applies status, year, sort and view mode without navigating', async () => {
    const { bloc, replace } = await searched();

    bloc.setStatus('CURRENTLY_AIRING');
    bloc.setYear('2019');
    bloc.setSort('score');
    bloc.setViewMode('list');

    expect(bloc.status).toBe('CURRENTLY_AIRING');
    expect(bloc.year).toBe('2019');
    expect(bloc.sort).toBe('score');
    expect(bloc.viewMode).toBe('list');
    // These narrow the page already on screen; a history entry for each would
    // make the back button undo a dropdown.
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not re-query the catalogue for a local filter', async () => {
    const { bloc, search } = await searched({ hits: [hit('1')], total: 1 });

    bloc.setStatus('FINISHED_AIRING');
    bloc.setYear('2001');
    await flush();

    expect(search).toHaveBeenCalledTimes(1);
  });

  it('coerces the numbers a select can hand back into strings', async () => {
    const { bloc } = await searched();

    bloc.setYear(2019 as unknown as number);

    expect(bloc.year).toBe('2019');
  });

  it('narrows the results already on screen through the local filters', async () => {
    const { bloc } = await searched({
      hits: [hit('1', { status: 'FINISHED_AIRING' }), hit('2', { status: 'CURRENTLY_AIRING' })],
      total: 2,
    });

    bloc.setStatus('CURRENTLY_AIRING');

    expect(bloc.results.map((r) => r.id)).toEqual(['2']);
    // The total is what the catalogue said, not what survived the local pass.
    expect(bloc.totalResults).toBe(2);
  });
});

describe('the fetched layer', () => {
  it('holds the normalised hits, the works and the total from one response', async () => {
    const { bloc } = await searched({
      hits: [hit('1', { synopsis: 'A story.', genres: '["Action"]' })],
      total: 42,
      works: [{ slug: 'berserk', type: 'MANGA' }],
    });

    expect(bloc.results).toHaveLength(1);
    expect(bloc.results[0].description).toBe('A story.');
    expect(bloc.results[0].tags).toEqual(['Action']);
    expect(bloc.works).toHaveLength(1);
    expect(bloc.totalResults).toBe(42);
  });

  it('loads the genre strip', async () => {
    const { bloc } = setup({ genres: async () => genreList(3) });

    await bloc.init();
    await vi.waitFor(() => expect(bloc.isLoadingGenres).toBe(false));

    expect(bloc.hasGenres).toBe(true);
    expect(bloc.visibleGenres).toHaveLength(3);
  });
});

/* ── The genre is one value ──────────────────────────────────────────────── */

describe('genre selection', () => {
  it('selects a genre by writing a URL rather than assigning state', async () => {
    const { bloc, replace } = await searched();

    bloc.toggleGenre('Action');

    expect(replace).toHaveBeenCalledWith('?query=naruto&genre=Action');
    // Not selected yet: the URL is the source of truth and it has not been read.
    expect(bloc.selectedGenre).toBeNull();

    bloc.syncFromUrl();
    expect(bloc.selectedGenre).toBe('Action');
    expect(bloc.isGenreSelected('Action')).toBe(true);
  });

  it('replaces the first genre when a second one is picked', async () => {
    // The genre used to be held as an array, so a second selection went into a
    // list the URL could only carry one entry of -- and was silently dropped.
    const { bloc } = await searched();

    bloc.toggleGenre('Action');
    bloc.syncFromUrl();
    bloc.toggleGenre('Comedy');
    bloc.syncFromUrl();

    expect(bloc.selectedGenre).toBe('Comedy');
    expect(bloc.isGenreSelected('Comedy')).toBe(true);
    expect(bloc.isGenreSelected('Action')).toBe(false);
  });

  it('deselects the active genre when its chip is clicked again', async () => {
    const { bloc } = await searched({}, '?query=naruto&genre=Action');

    bloc.toggleGenre('Action');
    bloc.syncFromUrl();

    expect(bloc.selectedGenre).toBeNull();
    // The draft box still holds "naruto", so the query survives the deselection.
    expect(bloc.committedQuery).toBe('naruto');
  });

  it('drops the abandoned query when the last filter goes and the box is empty', async () => {
    const { bloc } = await searched({}, '?genre=Action');
    bloc.draftQuery = '';

    bloc.toggleGenre('Action');
    bloc.syncFromUrl();

    expect(bloc.selectedGenre).toBeNull();
    expect(bloc.committedQuery).toBe('');
    expect(bloc.phase).toBe('browse');
  });

  it('re-queries the catalogue with the genre once the URL lands', async () => {
    const { bloc, search, lastRequest } = await searched();

    bloc.toggleGenre('Action');
    bloc.syncFromUrl();
    await flush();

    expect(search).toHaveBeenCalledTimes(2);
    expect(lastRequest().genre).toBe('Action');
  });
});

/* ── syncFromUrl guards ──────────────────────────────────────────────────── */

describe('syncFromUrl', () => {
  it('does nothing before init', () => {
    const { bloc, navigate, search } = setup();

    navigate({ search: '?query=naruto' });
    bloc.syncFromUrl();

    expect(bloc.committedQuery).toBe('');
    expect(search).not.toHaveBeenCalled();
  });

  it('reads the URL first, so a bailing-out caller effect stays subscribed', () => {
    // Bailing out before the read would leave the view's effect tracking
    // nothing, and it would never run again for any later URL.
    const { bloc, subscribed } = setup();
    const before = subscribed.mock.calls.length;

    bloc.syncFromUrl();

    expect(subscribed.mock.calls.length).toBeGreaterThan(before);
  });

  it('ignores a URL for a different pathname', async () => {
    const { bloc, navigate, search } = await searched();

    // The browse strip renders on other pages; their URLs are not this page's.
    navigate({ pathname: '/anime/naruto', search: '?query=bleach' });
    bloc.syncFromUrl();
    await flush();

    expect(bloc.committedQuery).toBe('naruto');
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('ignores a URL whose search string has not changed', async () => {
    const { bloc, search } = await searched();

    bloc.syncFromUrl();
    bloc.syncFromUrl();
    await flush();

    expect(search).toHaveBeenCalledTimes(1);
  });

  it('does not re-search when only an unrelated parameter changed', async () => {
    const { bloc, navigate, search } = await searched();

    navigate({ search: '?query=naruto&utm_source=twitter' });
    bloc.syncFromUrl();
    await flush();

    // The search string differs, but the search itself does not.
    expect(bloc.committedQuery).toBe('naruto');
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('runs a fresh search when the query changes underneath it', async () => {
    const { bloc, navigate, search, lastRequest } = await searched();

    navigate({ search: '?query=bleach' });
    bloc.syncFromUrl();
    await flush();

    expect(search).toHaveBeenCalledTimes(2);
    expect(lastRequest().query).toBe('bleach');
    expect(bloc.draftQuery).toBe('bleach');
  });
});

/* ── init ────────────────────────────────────────────────────────────────── */

describe('init', () => {
  it('is idempotent, so a remount does not double the first search', async () => {
    const { bloc, search } = setup({ search: '?query=naruto' });

    await bloc.init();
    await bloc.init();

    expect(search).toHaveBeenCalledTimes(1);
  });

  it('does not block the first search on the viewer list round trip', async () => {
    // The list only decorates cards; five requests' worth of latency is the
    // wrong thing to put in front of the results.
    const { bloc, search } = setup({
      search: '?query=naruto',
      list: () => new Promise<Map<string, string>>(() => {}),
    });

    await bloc.init();

    expect(search).toHaveBeenCalledTimes(1);
  });

  it('skips the search entirely in the browse state', async () => {
    const { bloc, search } = setup({ search: '' });

    await bloc.init();

    expect(search).not.toHaveBeenCalled();
    expect(bloc.hasSearched).toBe(false);
    expect(bloc.phase).toBe('browse');
  });

  it('still loads the genre strip in the browse state', async () => {
    const { bloc, genreFacets } = setup({ search: '', genres: async () => genreList(2) });

    await bloc.init();
    await vi.waitFor(() => expect(bloc.hasGenres).toBe(true));

    expect(genreFacets).toHaveBeenCalledTimes(1);
  });

  it('searches for a genre-only URL with no query at all', async () => {
    const { bloc, search, lastRequest } = setup({ search: '?genre=Action' });

    await bloc.init();

    expect(search).toHaveBeenCalledTimes(1);
    expect(lastRequest().query).toBe('');
    expect(bloc.hasSearched).toBe(true);
  });

  it('treats a whitespace-only query as the browse state', async () => {
    const { bloc, search } = setup({ search: '?query=%20%20' });

    await bloc.init();

    expect(search).not.toHaveBeenCalled();
    expect(bloc.phase).toBe('browse');
  });
});

/* ── The request-sequence guard ──────────────────────────────────────────── */

describe('the request-sequence guard', () => {
  it('does not let a superseded response overwrite a newer one', async () => {
    const pending: ReturnType<typeof deferred<CatalogSearchResponse>>[] = [];
    const harness = setup({
      search: '?query=a',
      respond: () => {
        const next = deferred<CatalogSearchResponse>();
        pending.push(next);
        return next.promise;
      },
    });

    const first = harness.bloc.init(); // search A
    harness.navigate({ search: '?query=b' });
    harness.bloc.syncFromUrl(); // search B
    expect(pending).toHaveLength(2);

    pending[1].resolve(response({ hits: [hit('b')], total: 2 }));
    await flush();
    pending[0].resolve(response({ hits: [hit('a')], total: 1 }));
    await flush();
    await first;

    expect(harness.bloc.results.map((r) => r.id)).toEqual(['b']);
    expect(harness.bloc.totalResults).toBe(2);
  });

  it('leaves loading finished once the newest response has landed', async () => {
    const pending: ReturnType<typeof deferred<CatalogSearchResponse>>[] = [];
    const harness = setup({
      search: '?query=a',
      respond: () => {
        const next = deferred<CatalogSearchResponse>();
        pending.push(next);
        return next.promise;
      },
    });

    const first = harness.bloc.init();
    harness.navigate({ search: '?query=b' });
    harness.bloc.syncFromUrl();

    pending[1].resolve(response({ hits: [hit('b')], total: 2 }));
    await flush();
    expect(harness.bloc.isLoading).toBe(false);

    // The stale one finishing must not put the spinner back.
    pending[0].resolve(response({ hits: [hit('a')], total: 1 }));
    await flush();
    await first;

    expect(harness.bloc.isLoading).toBe(false);
  });

  it('does not let a superseded failure blank the newer results', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const pending: ReturnType<typeof deferred<CatalogSearchResponse>>[] = [];
    const harness = setup({
      search: '?query=a',
      respond: () => {
        const next = deferred<CatalogSearchResponse>();
        pending.push(next);
        return next.promise;
      },
    });

    const first = harness.bloc.init().catch(() => {});
    harness.navigate({ search: '?query=b' });
    harness.bloc.syncFromUrl();

    pending[1].resolve(response({ hits: [hit('b')], total: 2 }));
    await flush();
    pending[0].reject(new Error('the abandoned query timed out'));
    await flush();
    await first;

    expect(harness.bloc.results.map((r) => r.id)).toEqual(['b']);
    expect(harness.bloc.totalResults).toBe(2);
    expect(harness.bloc.isLoading).toBe(false);
  });
});

/* ── What the port is asked for ──────────────────────────────────────────── */

describe('the request the search port receives', () => {
  it('asks for works alongside a plain first-page query', async () => {
    const { lastRequest } = await searched({}, '?query=naruto');

    expect(lastRequest()).toEqual({
      query: 'naruto',
      page: 0,
      hitsPerPage: PAGE_SIZE_OPTIONS[0],
      genre: null,
      includeWorks: true,
    });
  });

  it('skips the works when a genre is filtering the query', async () => {
    // `tags` is an anime facet no work carries, so one query cannot honour both.
    const { lastRequest } = await searched({}, '?query=naruto&genre=Action');

    expect(lastRequest()).toEqual({
      query: 'naruto',
      page: 0,
      hitsPerPage: PAGE_SIZE_OPTIONS[0],
      genre: 'Action',
      includeWorks: false,
    });
  });

  it('skips the works when browsing a genre with no query', async () => {
    const { lastRequest } = await searched({}, '?genre=Action');

    expect(lastRequest()).toEqual({
      query: '',
      page: 0,
      hitsPerPage: PAGE_SIZE_OPTIONS[0],
      genre: 'Action',
      includeWorks: false,
    });
  });

  it('skips the works on every page after the first', async () => {
    const harness = await searched({ hits: [hit('1')], total: 100 }, '?query=naruto');

    harness.bloc.goToPage(1);
    await flush();

    expect(harness.lastRequest()).toEqual({
      query: 'naruto',
      page: 1,
      hitsPerPage: PAGE_SIZE_OPTIONS[0],
      genre: null,
      includeWorks: false,
    });
  });

  it('trims the query before it reaches the port', async () => {
    const { lastRequest } = await searched({}, '?query=%20%20naruto%20%20');

    expect(lastRequest().query).toBe('naruto');
  });

  it('sends the page size the reader chose', async () => {
    const harness = await searched({ hits: [hit('1')], total: 100 });

    harness.bloc.setPerPage(48);
    await flush();

    expect(harness.lastRequest().hitsPerPage).toBe(48);
  });
});

/* ── Pagination ──────────────────────────────────────────────────────────── */

describe('pagination', () => {
  it('counts the pages by rounding a partial last page up', async () => {
    const { bloc } = await searched({ hits: [hit('1')], total: 50 });

    expect(bloc.perPage).toBe(24);
    expect(bloc.totalPages).toBe(3);
  });

  it('has no pages at all when nothing matched', async () => {
    const { bloc } = await searched({ hits: [], total: 0 });

    expect(bloc.totalPages).toBe(0);
    expect(bloc.page).toBe(0);
  });

  it('refuses a page below zero and leaves the page where it was', async () => {
    const harness = await searched({ hits: [hit('1')], total: 100 });
    harness.bloc.goToPage(2);
    await flush();

    harness.bloc.goToPage(-1);
    await flush();

    expect(harness.bloc.page).toBe(2);
    expect(harness.search).toHaveBeenCalledTimes(2);
  });

  it('refuses a page past the last one and leaves the page where it was', async () => {
    const harness = await searched({ hits: [hit('1')], total: 50 }); // 3 pages: 0..2
    harness.bloc.goToPage(1);
    await flush();

    harness.bloc.goToPage(3);
    await flush();

    expect(harness.bloc.page).toBe(1);
    expect(harness.search).toHaveBeenCalledTimes(2);
  });

  it('refuses any page when there is nothing to page through', async () => {
    const harness = await searched({ hits: [], total: 0 });

    harness.bloc.goToPage(0);
    await flush();

    expect(harness.search).toHaveBeenCalledTimes(1);
  });

  it('keeps the page it was sent to rather than resetting to the first', async () => {
    const harness = await searched({ hits: [hit('1')], total: 100 });

    harness.bloc.goToPage(2);
    await flush();

    expect(harness.bloc.page).toBe(2);
    expect(harness.lastRequest().page).toBe(2);
  });

  it('returns to the first page when the page size changes', async () => {
    // Page 3 of 24-per-page is not page 3 of 100-per-page; staying would land
    // the reader somewhere they did not ask for.
    const harness = await searched({ hits: [hit('1')], total: 500 });
    harness.bloc.goToPage(4);
    await flush();

    harness.bloc.setPerPage(100);
    await flush();

    expect(harness.bloc.page).toBe(0);
    expect(harness.lastRequest().page).toBe(0);
    expect(harness.bloc.perPage).toBe(100);
  });

  it('resets to the first page for a brand new query', async () => {
    const harness = await searched({ hits: [hit('1')], total: 500 });
    harness.bloc.goToPage(3);
    await flush();

    harness.navigate({ search: '?query=bleach' });
    harness.bloc.syncFromUrl();
    await flush();

    expect(harness.bloc.page).toBe(0);
    expect(harness.lastRequest().page).toBe(0);
  });
});

/* ── What the view switches on ───────────────────────────────────────────── */

describe('phase', () => {
  it('is browse before anything has been searched', () => {
    const { bloc } = setup();

    expect(bloc.phase).toBe('browse');
  });

  it('is loading while a search is in flight', async () => {
    const pending = deferred<CatalogSearchResponse>();
    const harness = setup({ search: '?query=naruto', respond: () => pending.promise });

    const running = harness.bloc.init();
    expect(harness.bloc.phase).toBe('loading');

    pending.resolve(response({ hits: [hit('1')], total: 1 }));
    await running;
    expect(harness.bloc.phase).toBe('results');
  });

  it('is empty when the search came back with nothing', async () => {
    const { bloc } = await searched({ hits: [], total: 0 });

    expect(bloc.phase).toBe('empty');
    expect(bloc.hasResults).toBe(false);
  });

  it('is empty when the local filters removed every hit', async () => {
    const { bloc } = await searched({ hits: [hit('1', { status: 'FINISHED_AIRING' })], total: 1 });

    bloc.setStatus('CURRENTLY_AIRING');

    expect(bloc.phase).toBe('empty');
  });

  it('is back to browse once the search is cleared', async () => {
    const { bloc } = await searched({ hits: [hit('1')], total: 1 });

    bloc.clear();
    bloc.syncFromUrl();

    expect(bloc.phase).toBe('browse');
  });
});

describe('resultsSummary', () => {
  it('is singular for exactly one result', async () => {
    const { bloc } = await searched({ hits: [hit('1')], total: 1 });

    expect(bloc.resultsSummary).toBe("1 result for 'naruto'");
  });

  it('is plural and grouped for a large total', async () => {
    const { bloc } = await searched({ hits: [hit('1')], total: 1204 });

    expect(bloc.resultsSummary).toBe("1,204 results for 'naruto'");
  });

  it('names the genre when there is no query', async () => {
    const { bloc } = await searched({ hits: [hit('1')], total: 9 }, '?genre=Slice of Life');

    expect(bloc.resultsSummary).toBe('9 results in Slice of Life');
  });

  it('prefers the query over the genre when both are set', async () => {
    const { bloc } = await searched({ hits: [hit('1')], total: 3 }, '?query=naruto&genre=Action');

    expect(bloc.resultsSummary).toBe("3 results for 'naruto'");
  });

  it('is a bare count when nothing has been searched', () => {
    const { bloc } = setup();

    expect(bloc.resultsSummary).toBe('0 results');
  });
});

/* ── The active-filter pills ─────────────────────────────────────────────── */

describe('activeFilters', () => {
  it('is empty when nothing is narrowing the page', async () => {
    const { bloc } = await searched();

    expect(bloc.activeFilters).toEqual([]);
    expect(bloc.hasActiveFilters).toBe(false);
  });

  it('lists the genre, then the status, then the year', async () => {
    const { bloc } = await searched({}, '?query=naruto&genre=Action');
    bloc.setStatus('CURRENTLY_AIRING');
    bloc.setYear('2019');

    expect(bloc.activeFilters.map((f) => f.key)).toEqual(['genre:Action', 'status', 'year']);
    expect(bloc.activeFilters.map((f) => f.label)).toEqual(['Action', 'Airing', '2019']);
    expect(bloc.hasActiveFilters).toBe(true);
  });

  it('falls back to the raw value for a status it has no label for', async () => {
    const { bloc } = await searched();
    bloc.setStatus('SOMETHING_NEW');

    expect(bloc.activeFilters[0].label).toBe('SOMETHING_NEW');
  });

  it('removes the genre when the genre pill is dismissed', async () => {
    const { bloc } = await searched({}, '?query=naruto&genre=Action');

    bloc.activeFilters[0].remove();
    bloc.syncFromUrl();

    expect(bloc.selectedGenre).toBeNull();
    expect(bloc.activeFilters).toEqual([]);
  });

  it('removes the status when the status pill is dismissed', async () => {
    const { bloc } = await searched();
    bloc.setStatus('CURRENTLY_AIRING');

    bloc.activeFilters[0].remove();

    expect(bloc.status).toBe('');
    expect(bloc.hasActiveFilters).toBe(false);
  });

  it('removes the year when the year pill is dismissed', async () => {
    const { bloc } = await searched();
    bloc.setYear('2019');

    bloc.activeFilters[0].remove();

    expect(bloc.year).toBe('');
    expect(bloc.hasActiveFilters).toBe(false);
  });

  it('leaves the sort out: it reorders rather than narrows', async () => {
    const { bloc } = await searched();

    bloc.setSort('title');

    expect(bloc.hasActiveFilters).toBe(false);
  });
});

/* ── The genre strip ─────────────────────────────────────────────────────── */

describe('the genre strip', () => {
  async function withGenres(count: number) {
    const harness = setup({ genres: async () => genreList(count) });
    await harness.bloc.init();
    await vi.waitFor(() => expect(harness.bloc.isLoadingGenres).toBe(false));
    return harness;
  }

  it('shows nothing and hides nothing when the facet came back empty', async () => {
    const { bloc } = await withGenres(0);

    expect(bloc.hasGenres).toBe(false);
    expect(bloc.visibleGenres).toEqual([]);
    expect(bloc.hiddenGenreCount).toBe(0);
  });

  it('shows every genre when there are fewer than the strip holds', async () => {
    const { bloc } = await withGenres(INITIAL_GENRE_COUNT - 1);

    expect(bloc.visibleGenres).toHaveLength(INITIAL_GENRE_COUNT - 1);
    expect(bloc.hiddenGenreCount).toBe(0);
  });

  it('hides nothing at exactly the strip size', async () => {
    const { bloc } = await withGenres(INITIAL_GENRE_COUNT);

    expect(bloc.visibleGenres).toHaveLength(INITIAL_GENRE_COUNT);
    expect(bloc.hiddenGenreCount).toBe(0);
  });

  it('holds one back the moment there is one too many', async () => {
    const { bloc } = await withGenres(INITIAL_GENRE_COUNT + 1);

    expect(bloc.visibleGenres).toHaveLength(INITIAL_GENRE_COUNT);
    expect(bloc.hiddenGenreCount).toBe(1);
  });

  it('shows the rest once "+N more" is used', async () => {
    const { bloc } = await withGenres(INITIAL_GENRE_COUNT + 5);
    expect(bloc.showAllGenres).toBe(false);

    bloc.revealAllGenres();

    expect(bloc.showAllGenres).toBe(true);
    expect(bloc.visibleGenres).toHaveLength(INITIAL_GENRE_COUNT + 5);
    // The count itself does not change; the view stops rendering the chip on
    // `showAllGenres` instead.
    expect(bloc.hiddenGenreCount).toBe(5);
  });

  it('starts out loading so the strip renders skeletons, not an empty row', () => {
    const { bloc } = setup();

    expect(bloc.isLoadingGenres).toBe(true);
  });
});

/* ── Rows ────────────────────────────────────────────────────────────────── */

describe('works', () => {
  it('drops a work with no slug rather than linking to a certain 404', async () => {
    // workBySlug is the only lookup the schema exposes; there is no id route.
    const { bloc } = await searched({
      works: [{ slug: 'berserk' }, { slug: null }, { slug: '' }, {}],
    });

    expect(bloc.works.map((w) => w.slug)).toEqual(['berserk']);
  });

  it('is empty when the response carried no works at all', async () => {
    const { bloc } = await searched({ works: [] });

    expect(bloc.works).toEqual([]);
  });

  it('links a work by its slug', async () => {
    const { bloc } = await searched();

    expect(bloc.workHref({ slug: 'berserk' })).toBe('/manga/berserk');
  });

  it('describes a work by kind and year', async () => {
    const { bloc } = await searched();

    expect(bloc.workSubtitle({ type: 'LIGHT_NOVEL', published_from: '2009-04-10' })).toBe(
      'Light novel · 2009',
    );
  });
});

describe('hrefFor', () => {
  it('prefers the index\'s url_slug over a camelCase slug', async () => {
    // Algolia stores the CDC payload verbatim, so the field is url_slug.
    const { bloc } = await searched();

    expect(bloc.hrefFor({ id: '7', url_slug: 'naruto', slug: 'ignored' })).toBe('/anime/naruto');
  });

  it('falls back to the id when the record has no slug yet', async () => {
    const { bloc } = await searched();

    expect(bloc.hrefFor({ id: 'abc def' })).toBe('/anime/abc%20def');
  });
});

/* ── Clearing ────────────────────────────────────────────────────────────── */

describe('clear', () => {
  it('empties the draft, the status and the year and writes the browse URL', async () => {
    const { bloc, replace } = await searched({ hits: [hit('1')], total: 1 });
    bloc.setStatus('CURRENTLY_AIRING');
    bloc.setYear('2019');

    bloc.clear();

    expect(bloc.draftQuery).toBe('');
    expect(bloc.status).toBe('');
    expect(bloc.year).toBe('');
    expect(replace).toHaveBeenCalledWith('');
  });

  it('drops the results once the browse URL lands', async () => {
    const { bloc } = await searched({ hits: [hit('1')], total: 12 }, '?query=naruto&genre=Action');

    bloc.clear();
    bloc.syncFromUrl();

    expect(bloc.results).toEqual([]);
    expect(bloc.works).toEqual([]);
    expect(bloc.totalResults).toBe(0);
    expect(bloc.hasSearched).toBe(false);
    expect(bloc.selectedGenre).toBeNull();
  });

  it('keeps parameters it does not own on the way out', async () => {
    const { bloc, replace } = await searched({}, '?query=naruto&utm_source=twitter');

    bloc.clear();

    expect(replace).toHaveBeenCalledWith('?utm_source=twitter');
  });

  it('does not leave the sort or the view mode behind', async () => {
    // Deliberate: these are presentation, not a search, so clearing a search
    // must not throw away how the reader likes the page laid out.
    const { bloc } = await searched();
    bloc.setSort('title');
    bloc.setViewMode('list');

    bloc.clear();

    expect(bloc.sort).toBe('title');
    expect(bloc.viewMode).toBe('list');
  });
});

/* ── Ports that fail ─────────────────────────────────────────────────────── */

describe('a port that throws', () => {
  it('empties the results instead of throwing when the search rejects', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const harness = setup({
      search: '?query=naruto',
      respond: async () => {
        throw new Error('algolia is down');
      },
    });

    await expect(harness.bloc.init()).resolves.toBeUndefined();

    expect(harness.bloc.results).toEqual([]);
    expect(harness.bloc.works).toEqual([]);
    expect(harness.bloc.totalResults).toBe(0);
    expect(harness.bloc.isLoading).toBe(false);
    // hasSearched stays true, so the page shows "no results" rather than the
    // browse placeholder for a query that was genuinely attempted.
    expect(harness.bloc.hasSearched).toBe(true);
    expect(harness.bloc.phase).toBe('empty');
    expect(errors).toHaveBeenCalled();
  });

  it('leaves the genre strip empty and finished when the facets reject', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const harness = setup({
      genres: async () => {
        throw new Error('facets unavailable');
      },
    });

    await harness.bloc.init();
    await vi.waitFor(() => expect(harness.bloc.isLoadingGenres).toBe(false));

    expect(harness.bloc.visibleGenres).toEqual([]);
    expect(harness.bloc.hasGenres).toBe(false);
  });

  it('leaves every card undecorated when the viewer list rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const harness = setup({
      search: '?query=naruto',
      list: async () => {
        throw new Error('not signed in');
      },
    });

    await harness.bloc.init();
    await flush();

    expect(harness.bloc.listStatusFor({ id: '1' })).toBeNull();
    expect(harness.bloc.results).toEqual([]);
  });
});

describe('listStatusFor', () => {
  it('reports the status the viewer gave an anime', async () => {
    const harness = setup({
      search: '?query=naruto',
      list: async () => new Map([['1', 'WATCHING']]),
    });

    await harness.bloc.init();
    await vi.waitFor(() => expect(harness.bloc.listStatusFor({ id: '1' })).toBe('WATCHING'));
  });

  it('is null for an anime that is not on the list', async () => {
    const harness = setup({ list: async () => new Map([['1', 'WATCHING']]) });
    await harness.bloc.init();
    await flush();

    expect(harness.bloc.listStatusFor({ id: '2' })).toBeNull();
  });

  it('is null for a hit with no id at all', async () => {
    const harness = setup({ list: async () => new Map([['1', 'WATCHING']]) });
    await harness.bloc.init();
    await flush();

    expect(harness.bloc.listStatusFor({})).toBeNull();
  });
});

describe('yearSelectOptions', () => {
  it('opens with "All years" so the filter can be cleared from the select itself', () => {
    const { bloc } = setup();

    expect(bloc.yearSelectOptions[0]).toEqual({ value: '', label: 'All years' });
    expect(bloc.yearSelectOptions.length).toBeGreaterThan(1);
  });
});
