import { describe, it, expect } from 'vitest';
import {
  clearSearch,
  isBrowseState,
  isSameSearch,
  laidOut,
  narrow,
  paged,
  readSearchUrl,
  submitQuery,
  toggleGenre,
  writeSearchUrl,
  EMPTY_SEARCH_STATE,
  type SearchUrlState,
} from './SearchPage.urlState';

/**
 * The /search page's URL sync.
 *
 * These rules are the ones that broke before: query and genre used to be
 * written with SvelteKit's shallow `replaceState`, so the page's sync block
 * compared a pre-advanced marker against a stale URL and "corrected" the state
 * back, wiping the selection that had just been made. Pulling the arithmetic
 * out into pure functions is what makes it checkable at all -- the component
 * can only be exercised through a browser.
 *
 * Everything the reader chooses is in the URL now -- status, year, sort, view
 * and the pages joined the query and the genre -- so Back and reload resume
 * the page as it was.
 */

/** A state with only the named fields off their defaults. */
const state = (partial: Partial<SearchUrlState> = {}): SearchUrlState => ({ ...EMPTY_SEARCH_STATE, ...partial });

describe('readSearchUrl', () => {
  it('reads the query and genre out of a search string', () => {
    expect(readSearchUrl('?query=naruto&genre=Action')).toEqual(state({ query: 'naruto', genre: 'Action' }));
  });

  it('accepts a bare search string with no leading question mark', () => {
    expect(readSearchUrl('query=naruto')).toEqual(state({ query: 'naruto' }));
  });

  it('is the default state for an empty URL', () => {
    expect(readSearchUrl('')).toEqual(EMPTY_SEARCH_STATE);
  });

  it('treats an empty genre parameter as no selection', () => {
    // `?genre=` is what a half-built link looks like; it is not a genre called "".
    expect(readSearchUrl('?genre=').genre).toBeNull();
  });

  it('decodes a genre with a space in it', () => {
    expect(readSearchUrl('?genre=Slice+of+Life').genre).toBe('Slice of Life');
    expect(readSearchUrl('?genre=Slice%20of%20Life').genre).toBe('Slice of Life');
  });

  it('accepts URLSearchParams as well as a string', () => {
    expect(readSearchUrl(new URLSearchParams('query=bleach'))).toEqual(state({ query: 'bleach' }));
  });

  it('reads the status, year, sort and view', () => {
    expect(readSearchUrl('?status=CURRENTLY_AIRING&year=2019&sort=score&view=list')).toEqual(
      state({ status: 'CURRENTLY_AIRING', year: 2019, sort: 'score', view: 'list' }),
    );
  });

  it('falls back to the default for a value it does not know', () => {
    // A hand-edited or stale link must not put the page in a state it has no
    // select option for.
    expect(readSearchUrl('?status=AIRING&year=19&sort=random&view=table')).toEqual(EMPTY_SEARCH_STATE);
    expect(readSearchUrl('?year=20019').year).toBeNull();
  });

  it('reads one-based pages into zero-based ones, and only a known size', () => {
    expect(readSearchUrl('?page=3&wpage=2&perPage=48')).toEqual(state({ hitsPage: 2, worksPage: 1, perPage: 48 }));
    expect(readSearchUrl('?page=0&wpage=x&perPage=7')).toEqual(EMPTY_SEARCH_STATE);
    expect(readSearchUrl('?page=1')).toMatchObject({ hitsPage: 0 });
  });
});

describe('writeSearchUrl', () => {
  it('writes both parameters', () => {
    const out = writeSearchUrl('', state({ query: 'naruto', genre: 'Action' }));
    expect(readSearchUrl(out)).toEqual(state({ query: 'naruto', genre: 'Action' }));
  });

  it('removes a parameter rather than writing an empty one', () => {
    expect(writeSearchUrl('?query=naruto&genre=Action', EMPTY_SEARCH_STATE)).toBe('');
  });

  it('keeps every default out of the URL', () => {
    // No `?sort=relevance&view=grid&page=1` on every link: a plain search is a
    // plain URL, and a default written out would read as a change to the sync.
    expect(writeSearchUrl('', EMPTY_SEARCH_STATE)).toBe('');
    expect(writeSearchUrl('?sort=score&view=list&page=3&perPage=48&status=FINISHED_AIRING&year=2001', EMPTY_SEARCH_STATE)).toBe('');
  });

  it('writes everything that is off its default, in the page\'s own spelling', () => {
    const full = state({
      query: 'naruto', genre: 'Action', status: 'NOT_YET_AIRED', year: 2027, sort: 'newest', view: 'list',
      hitsPage: 2, worksPage: 1, perPage: 72,
    });
    expect(writeSearchUrl('', full)).toBe(
      '?query=naruto&genre=Action&status=NOT_YET_AIRED&year=2027&sort=newest&view=list&page=3&wpage=2&perPage=72',
    );
    expect(readSearchUrl(writeSearchUrl('', full))).toEqual(full);
  });

  it('preserves parameters it does not own', () => {
    // Campaign tags ride along on shared links; the first chip click used to
    // be enough to lose them.
    const out = writeSearchUrl('?utm_source=twitter&query=old', state({ query: 'new' }));
    expect(new URLSearchParams(out).get('utm_source')).toBe('twitter');
    expect(new URLSearchParams(out).get('query')).toBe('new');
  });

  it('round-trips through readSearchUrl for awkward values', () => {
    const awkward = state({ query: 'k-on!! & friends', genre: 'Slice of Life' });
    expect(readSearchUrl(writeSearchUrl('', awkward))).toEqual(awkward);
  });

  it('produces an empty string, not a bare "?", when nothing is left', () => {
    // A trailing "?" is a different URL to the browser and would make the sync
    // see a change on every clear.
    expect(writeSearchUrl('?query=x', clearSearch())).toBe('');
  });
});

describe('submitQuery', () => {
  it('commits the trimmed text and keeps the genre', () => {
    expect(submitQuery(state({ genre: 'Action' }), '  naruto  ')).toEqual(state({ query: 'naruto', genre: 'Action' }));
  });

  it('is a no-op for a blank submission', () => {
    // Enter on an empty field is not a request to clear the page, and treating
    // it as a state change would push a history entry for nothing.
    expect(submitQuery(state({ query: 'naruto' }), '   ')).toBeNull();
    expect(submitQuery(state(), '')).toBeNull();
  });

  it('starts a new question from its first page', () => {
    expect(submitQuery(state({ query: 'a', hitsPage: 4, worksPage: 2 }), 'b')).toMatchObject({ hitsPage: 0, worksPage: 0 });
  });
});

describe('toggleGenre', () => {
  const withQuery = state({ query: 'naruto' });

  it('selects a genre and keeps the committed query', () => {
    expect(toggleGenre(withQuery, 'Action', { hasDraftQuery: true })).toEqual(state({ query: 'naruto', genre: 'Action' }));
  });

  it('replaces the selection rather than adding to it', () => {
    // The URL has always carried one `genre`; the array that used to hold them
    // could take a second selection the URL then silently dropped.
    expect(toggleGenre(state({ genre: 'Action' }), 'Comedy', { hasDraftQuery: false })).toEqual(state({ genre: 'Comedy' }));
  });

  it('deselects the active genre', () => {
    expect(toggleGenre(state({ genre: 'Action' }), 'Action', { hasDraftQuery: false })).toEqual(state());
  });

  it('drops the query too when the last filter goes and the box is empty', () => {
    // Otherwise clearing the last chip leaves a query in the URL the reader had
    // already abandoned, and the page keeps showing its results.
    expect(toggleGenre(state({ query: 'naruto', genre: 'Action' }), 'Action', { hasDraftQuery: false })).toEqual(state());
  });

  it('keeps the query when something is still typed in the box', () => {
    // The draft is deliberately not the committed query: the reader can be
    // mid-edit, and their text must survive dropping a genre.
    expect(toggleGenre(state({ query: 'naruto', genre: 'Action' }), 'Action', { hasDraftQuery: true })).toEqual(state({ query: 'naruto' }));
  });

  it('keeps the status and year, and returns to the first page', () => {
    const narrowed = state({ status: 'FINISHED_AIRING', year: 1998, hitsPage: 3 });
    expect(toggleGenre(narrowed, 'Drama', { hasDraftQuery: false })).toEqual(
      state({ genre: 'Drama', status: 'FINISHED_AIRING', year: 1998 }),
    );
  });
});

describe('narrow', () => {
  it('sets the status or year and returns to the first page', () => {
    const paged3 = state({ query: 'naruto', hitsPage: 3, worksPage: 1 });
    expect(narrow(paged3, { status: 'CURRENTLY_AIRING' })).toEqual(state({ query: 'naruto', status: 'CURRENTLY_AIRING' }));
    expect(narrow(paged3, { year: 2019 })).toEqual(state({ query: 'naruto', year: 2019 }));
    expect(narrow(state({ status: 'CURRENTLY_AIRING' }), { status: null })).toEqual(state());
  });
});

describe('paged', () => {
  it('moves one grid without touching the other', () => {
    expect(paged(state({ worksPage: 2 }), { hitsPage: 4 })).toEqual(state({ hitsPage: 4, worksPage: 2 }));
  });

  it('returns both grids to their first page when the size changes', () => {
    // Page 3 of 24-per-page is not page 3 of 100-per-page; staying would land
    // the reader somewhere they did not ask for.
    expect(paged(state({ hitsPage: 4, worksPage: 3 }), { perPage: 100 })).toEqual(state({ perPage: 100 }));
    expect(paged(state({ hitsPage: 4, perPage: 48 }), { perPage: 48 })).toEqual(state({ hitsPage: 4, perPage: 48 }));
  });
});

describe('laidOut', () => {
  it('changes the sort or the view and nothing else', () => {
    const deep = state({ query: 'naruto', genre: 'Action', hitsPage: 2 });
    expect(laidOut(deep, { sort: 'title' })).toEqual({ ...deep, sort: 'title' });
    expect(laidOut(deep, { view: 'list' })).toEqual({ ...deep, view: 'list' });
  });
});

describe('clearSearch', () => {
  it('drops every filter but keeps how the page is laid out', () => {
    // Sort, view and page size are presentation, not a search; clearing a
    // search must not throw away how the reader likes the page.
    const everything = state({
      query: 'naruto', genre: 'Action', status: 'FINISHED_AIRING', year: 1998, sort: 'title', view: 'list', hitsPage: 3, perPage: 48,
    });
    expect(clearSearch(everything)).toEqual(state({ sort: 'title', view: 'list', perPage: 48 }));
    expect(clearSearch()).toEqual(EMPTY_SEARCH_STATE);
  });
});

describe('isBrowseState', () => {
  it('is true only when nothing narrows the catalogue', () => {
    expect(isBrowseState(state())).toBe(true);
    expect(isBrowseState(state({ query: '   ' }))).toBe(true);
    expect(isBrowseState(state({ sort: 'title', view: 'list', hitsPage: 2 }))).toBe(true);
    expect(isBrowseState(state({ genre: 'Action' }))).toBe(false);
    expect(isBrowseState(state({ query: 'naruto' }))).toBe(false);
    expect(isBrowseState(state({ status: 'CURRENTLY_AIRING' }))).toBe(false);
    expect(isBrowseState(state({ year: 2019 }))).toBe(false);
  });
});

describe('isSameSearch', () => {
  it('compares what the catalogue is asked, and ignores how the answer is laid out', () => {
    expect(isSameSearch(state({ query: 'a', genre: 'X' }), state({ query: 'a', genre: 'X' }))).toBe(true);
    expect(isSameSearch(state({ query: 'a', genre: 'X' }), state({ query: 'a', genre: 'Y' }))).toBe(false);
    expect(isSameSearch(state({ query: 'a' }), state({ query: 'b' }))).toBe(false);
    expect(isSameSearch(state(), state({ status: 'CURRENTLY_AIRING' }))).toBe(false);
    expect(isSameSearch(state(), state({ year: 2019 }))).toBe(false);
    expect(isSameSearch(state(), state({ hitsPage: 1 }))).toBe(false);
    expect(isSameSearch(state(), state({ worksPage: 1 }))).toBe(false);
    expect(isSameSearch(state(), state({ perPage: 48 }))).toBe(false);
    // The same answer, rearranged: no request.
    expect(isSameSearch(state(), state({ sort: 'title', view: 'list' }))).toBe(true);
  });
});

describe('the full cycle a chip click makes', () => {
  /** Write a state onto a URL, navigate, read it back -- what the page does. */
  function navigate(search: string, next: SearchUrlState): [string, SearchUrlState] {
    const written = writeSearchUrl(search, next);
    return [written, readSearchUrl(written)];
  }

  it('selecting, then deselecting, returns to the whole catalogue', () => {
    let search = '';
    let current = readSearchUrl(search);

    [search, current] = navigate(search, toggleGenre(current, 'Action', { hasDraftQuery: false }));
    expect(current).toEqual(state({ genre: 'Action' }));
    expect(isBrowseState(current)).toBe(false);

    [search, current] = navigate(search, toggleGenre(current, 'Action', { hasDraftQuery: false }));
    expect(current).toEqual(state());
    expect(isBrowseState(current)).toBe(true);
    expect(search).toBe('');
  });

  it('a deep link with every option survives being written back unchanged', () => {
    const link = '?query=naruto&genre=Action&status=CURRENTLY_AIRING&year=2019&sort=score&view=list&page=2&perPage=48';
    const [search, current] = navigate('', readSearchUrl(link));
    expect(current).toEqual(state({
      query: 'naruto', genre: 'Action', status: 'CURRENTLY_AIRING', year: 2019, sort: 'score', view: 'list', hitsPage: 1, perPage: 48,
    }));
    // Re-reading the URL the page just wrote must not look like a change, or
    // the sync would run a second search for the same thing on every render.
    expect(isSameSearch(readSearchUrl(search), current)).toBe(true);
    expect(search).toBe(link);
  });

  it('a query submitted over an existing genre keeps both', () => {
    const start = readSearchUrl('?genre=Action');
    const [, current] = navigate('?genre=Action', submitQuery(start, 'naruto')!);
    expect(current).toEqual(state({ query: 'naruto', genre: 'Action' }));
  });
});

describe('the q alias', () => {
  it('reads ?q= as the query and never writes it back', () => {
    expect(readSearchUrl('?q=naruto')).toEqual(state({ query: 'naruto' }));
    expect(readSearchUrl('?q=naruto&query=bleach').query).toBe('bleach');
    expect(writeSearchUrl('?q=naruto', state({ query: 'naruto' }))).toBe('?query=naruto');
  });
});
