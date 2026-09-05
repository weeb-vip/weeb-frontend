import { describe, it, expect } from '@jest/globals';
import {
  clearSearch,
  isBrowseState,
  isSameSearch,
  readSearchUrl,
  submitQuery,
  toggleGenre,
  writeSearchUrl,
  type SearchUrlState,
} from '../SearchPage.urlState';

/**
 * The /search page's URL sync.
 *
 * These rules are the ones that broke before: query and genre used to be
 * written with SvelteKit's shallow `replaceState`, so the page's sync block
 * compared a pre-advanced marker against a stale URL and "corrected" the state
 * back, wiping the selection that had just been made. Pulling the arithmetic
 * out into pure functions is what makes it checkable at all -- the component
 * can only be exercised through a browser.
 */
describe('readSearchUrl', () => {
  it('reads the query and genre out of a search string', () => {
    expect(readSearchUrl('?query=naruto&genre=Action')).toEqual({
      query: 'naruto',
      genre: 'Action',
    });
  });

  it('accepts a bare search string with no leading question mark', () => {
    expect(readSearchUrl('query=naruto')).toEqual({ query: 'naruto', genre: null });
  });

  it('is the browse state for an empty URL', () => {
    expect(readSearchUrl('')).toEqual({ query: '', genre: null });
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
    expect(readSearchUrl(new URLSearchParams('query=bleach'))).toEqual({
      query: 'bleach',
      genre: null,
    });
  });
});

describe('writeSearchUrl', () => {
  it('writes both parameters', () => {
    const out = writeSearchUrl('', { query: 'naruto', genre: 'Action' });
    expect(readSearchUrl(out)).toEqual({ query: 'naruto', genre: 'Action' });
  });

  it('removes a parameter rather than writing an empty one', () => {
    expect(writeSearchUrl('?query=naruto&genre=Action', { query: '', genre: null })).toBe('');
  });

  it('preserves parameters it does not own', () => {
    // Campaign tags ride along on shared links; the first chip click used to
    // be enough to lose them.
    const out = writeSearchUrl('?utm_source=twitter&query=old', { query: 'new', genre: null });
    expect(new URLSearchParams(out).get('utm_source')).toBe('twitter');
    expect(new URLSearchParams(out).get('query')).toBe('new');
  });

  it('round-trips through readSearchUrl for awkward values', () => {
    const state: SearchUrlState = { query: 'k-on!! & friends', genre: 'Slice of Life' };
    expect(readSearchUrl(writeSearchUrl('', state))).toEqual(state);
  });

  it('produces an empty string, not a bare "?", when nothing is left', () => {
    // A trailing "?" is a different URL to the browser and would make the sync
    // see a change on every clear.
    expect(writeSearchUrl('?query=x', clearSearch())).toBe('');
  });
});

describe('submitQuery', () => {
  it('commits the trimmed text and keeps the genre', () => {
    expect(submitQuery({ query: '', genre: 'Action' }, '  naruto  ')).toEqual({
      query: 'naruto',
      genre: 'Action',
    });
  });

  it('is a no-op for a blank submission', () => {
    // Enter on an empty field is not a request to clear the page, and treating
    // it as a state change would push a history entry for nothing.
    expect(submitQuery({ query: 'naruto', genre: null }, '   ')).toBeNull();
    expect(submitQuery({ query: '', genre: null }, '')).toBeNull();
  });
});

describe('toggleGenre', () => {
  const withQuery: SearchUrlState = { query: 'naruto', genre: null };

  it('selects a genre and keeps the committed query', () => {
    expect(toggleGenre(withQuery, 'Action', { hasDraftQuery: true })).toEqual({
      query: 'naruto',
      genre: 'Action',
    });
  });

  it('replaces the selection rather than adding to it', () => {
    // The URL has always carried one `genre`; the array that used to hold them
    // could take a second selection the URL then silently dropped.
    expect(
      toggleGenre({ query: '', genre: 'Action' }, 'Comedy', { hasDraftQuery: false }),
    ).toEqual({ query: '', genre: 'Comedy' });
  });

  it('deselects the active genre', () => {
    expect(toggleGenre({ query: '', genre: 'Action' }, 'Action', { hasDraftQuery: false })).toEqual(
      { query: '', genre: null },
    );
  });

  it('drops the query too when the last filter goes and the box is empty', () => {
    // Otherwise clearing the last chip leaves a query in the URL the reader had
    // already abandoned, and the page keeps showing its results.
    expect(
      toggleGenre({ query: 'naruto', genre: 'Action' }, 'Action', { hasDraftQuery: false }),
    ).toEqual({ query: '', genre: null });
  });

  it('keeps the query when something is still typed in the box', () => {
    // The draft is deliberately not the committed query: the reader can be
    // mid-edit, and their text must survive dropping a genre.
    expect(
      toggleGenre({ query: 'naruto', genre: 'Action' }, 'Action', { hasDraftQuery: true }),
    ).toEqual({ query: 'naruto', genre: null });
  });
});

describe('isBrowseState', () => {
  it('is true only when there is nothing to search', () => {
    expect(isBrowseState({ query: '', genre: null })).toBe(true);
    expect(isBrowseState({ query: '   ', genre: null })).toBe(true);
    expect(isBrowseState({ query: '', genre: 'Action' })).toBe(false);
    expect(isBrowseState({ query: 'naruto', genre: null })).toBe(false);
  });
});

describe('isSameSearch', () => {
  it('compares both halves', () => {
    expect(isSameSearch({ query: 'a', genre: 'X' }, { query: 'a', genre: 'X' })).toBe(true);
    expect(isSameSearch({ query: 'a', genre: 'X' }, { query: 'a', genre: 'Y' })).toBe(false);
    expect(isSameSearch({ query: 'a', genre: null }, { query: 'b', genre: null })).toBe(false);
  });
});

describe('the full cycle a chip click makes', () => {
  /** Write a state onto a URL, navigate, read it back -- what the page does. */
  function navigate(search: string, next: SearchUrlState): [string, SearchUrlState] {
    const written = writeSearchUrl(search, next);
    return [written, readSearchUrl(written)];
  }

  it('selecting, then deselecting, returns to the browse placeholder', () => {
    let search = '';
    let state = readSearchUrl(search);

    [search, state] = navigate(search, toggleGenre(state, 'Action', { hasDraftQuery: false }));
    expect(state).toEqual({ query: '', genre: 'Action' });
    expect(isBrowseState(state)).toBe(false);

    [search, state] = navigate(search, toggleGenre(state, 'Action', { hasDraftQuery: false }));
    expect(state).toEqual({ query: '', genre: null });
    expect(isBrowseState(state)).toBe(true);
    expect(search).toBe('');
  });

  it('a deep link with both filters survives being written back unchanged', () => {
    const [search, state] = navigate('', readSearchUrl('?query=naruto&genre=Action'));
    expect(state).toEqual({ query: 'naruto', genre: 'Action' });
    // Re-reading the URL the page just wrote must not look like a change, or
    // the sync would run a second search for the same thing on every render.
    expect(isSameSearch(readSearchUrl(search), state)).toBe(true);
  });

  it('a query submitted over an existing genre keeps both', () => {
    const start = readSearchUrl('?genre=Action');
    const [, state] = navigate('?genre=Action', submitQuery(start, 'naruto')!);
    expect(state).toEqual({ query: 'naruto', genre: 'Action' });
  });
});
