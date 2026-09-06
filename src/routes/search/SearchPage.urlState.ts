/**
 * The /search page's URL sync, as pure functions.
 *
 * The URL is the single source of truth for what is being searched: the query
 * and the genre. Every handler on the page writes a URL and lets the navigation
 * come back around to set the state -- which is the only ordering that works,
 * because SvelteKit's `page.url` updates asynchronously and a handler that set
 * both would race itself.
 *
 * That makes this module the fiddly half of the page, so it is a plain module
 * with no runes and no SvelteKit imports: it can be unit-tested directly, and
 * `SearchPage.bloc.svelte.ts` only has to decide *when* to call it.
 *
 * One genre, not many. The page's chips have always read one `genre` parameter
 * and written one back; the array that used to hold them could take a second
 * selection that the URL then silently dropped on the next navigation.
 */

export interface SearchUrlState {
  /** The committed query -- what was actually searched, not what is being typed. */
  query: string;
  /** The selected genre, or null. */
  genre: string | null;
}

export const EMPTY_SEARCH_STATE: SearchUrlState = { query: '', genre: null };

/** What a URL says is being searched. */
export function readSearchUrl(search: string | URLSearchParams): SearchUrlState {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const genre = params.get('genre');

  return {
    query: params.get('query') || '',
    // A `?genre=` with nothing after it is not a selection.
    genre: genre ? genre : null,
  };
}

/**
 * The state written back onto an existing query string.
 *
 * Unrelated parameters are preserved -- campaign tags and the like ride along
 * on shared links, and dropping them on the first chip click would lose them.
 * An empty query or a null genre removes the parameter rather than writing a
 * blank one, so a cleared search leaves a clean URL.
 */
export function writeSearchUrl(currentSearch: string, next: SearchUrlState): string {
  const params = new URLSearchParams(currentSearch);

  if (next.query) params.set('query', next.query);
  else params.delete('query');

  if (next.genre) params.set('genre', next.genre);
  else params.delete('genre');

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Two states describe the same search. Used to skip a navigation that changes nothing. */
export function isSameSearch(a: SearchUrlState, b: SearchUrlState): boolean {
  return a.query === b.query && a.genre === b.genre;
}

/** Nothing to search: the page shows its browse placeholder rather than results. */
export function isBrowseState(state: SearchUrlState): boolean {
  return !state.query.trim() && !state.genre;
}

/**
 * Committing the text in the search box.
 *
 * Returns null for a blank submission -- pressing Enter on an empty field is
 * not a request to clear the page, it is a no-op, and treating it as a state
 * change would push a history entry for nothing.
 */
export function submitQuery(state: SearchUrlState, raw: string): SearchUrlState | null {
  const query = raw.trim();
  if (!query) return null;
  return { ...state, query };
}

/**
 * Clicking a genre chip.
 *
 * Selecting one keeps whatever query is committed. Deselecting the active one
 * drops the query too *unless* something is typed in the box -- otherwise
 * clearing the last filter would leave a query in the URL that the reader had
 * already abandoned, and the page would keep showing its results.
 *
 * `hasDraftQuery` is what is in the input right now, which is deliberately not
 * the same as `state.query`: the reader can have typed without submitting.
 */
export function toggleGenre(
  state: SearchUrlState,
  genre: string,
  { hasDraftQuery }: { hasDraftQuery: boolean },
): SearchUrlState {
  if (state.genre === genre) {
    return { query: hasDraftQuery ? state.query : '', genre: null };
  }
  return { query: state.query, genre };
}

/** "Clear all", and the × on the search field: back to the browse placeholder. */
export function clearSearch(): SearchUrlState {
  return { ...EMPTY_SEARCH_STATE };
}
