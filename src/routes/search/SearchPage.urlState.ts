/**
 * The /search page's URL sync, as pure functions.
 *
 * The URL is the single source of truth for everything the page is showing:
 * the query, the genre, the status and year filters, the sort, the view and
 * the pages. Every handler on the page writes a URL and lets the navigation
 * come back around to set the state -- which is the only ordering that works,
 * because SvelteKit's `page.url` updates asynchronously and a handler that set
 * both would race itself. It is also what makes Back and reload resume where
 * the reader was: a page they scrolled to, a status they picked, all of it is
 * in the address bar.
 *
 * That makes this module the fiddly half of the page, so it is a plain module
 * with no runes and no SvelteKit imports: it can be unit-tested directly, and
 * `SearchPage.bloc.svelte.ts` only has to decide *when* to call it.
 *
 * One genre, not many. The page's chips have always read one `genre` parameter
 * and written one back; the array that used to hold them could take a second
 * selection that the URL then silently dropped on the next navigation.
 */
import type { SortKey } from './SearchPage.results';

export const PAGE_SIZE_OPTIONS = [24, 48, 72, 100];
/** The page's spelling of the status filter; `search.logic` turns it into dates. */
export const STATUS_VALUES = ['CURRENTLY_AIRING', 'FINISHED_AIRING', 'NOT_YET_AIRED'];
export const SORT_KEYS: SortKey[] = ['relevance', 'score', 'newest', 'title'];
export type ViewMode = 'grid' | 'list';
export const VIEW_MODES: ViewMode[] = ['grid', 'list'];

export interface SearchUrlState {
  /** The committed query -- what was actually searched, not what is being typed. */
  query: string;
  /** The selected genre, or null. */
  genre: string | null;
  /** One of STATUS_VALUES, or null for any. */
  status: string | null;
  /** A broadcast year, or null for any. */
  year: number | null;
  sort: SortKey;
  view: ViewMode;
  /** Zero-based, matching Algolia; the URL spells them one-based. */
  hitsPage: number;
  worksPage: number;
  perPage: number;
}

export const EMPTY_SEARCH_STATE: SearchUrlState = {
  query: '',
  genre: null,
  status: null,
  year: null,
  sort: 'relevance',
  view: 'grid',
  hitsPage: 0,
  worksPage: 0,
  perPage: PAGE_SIZE_OPTIONS[0],
};

/** `?page=3` is the third page; the request wants 2. Anything else is the first. */
function pageParam(params: URLSearchParams, name: string): number {
  const n = Number.parseInt(params.get(name) || '', 10);
  return Number.isFinite(n) && n > 1 ? n - 1 : 0;
}

function yearParam(params: URLSearchParams): number | null {
  const n = Number.parseInt(params.get('year') || '', 10);
  return Number.isFinite(n) && n >= 1900 && n <= 2100 ? n : null;
}

function oneOf<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/** What a URL says is being shown. Anything it does not spell is the default. */
export function readSearchUrl(search: string | URLSearchParams): SearchUrlState {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const genre = params.get('genre');
  const status = params.get('status');
  const perPage = Number.parseInt(params.get('perPage') || '', 10);

  return {
    // `q` is accepted as an alias so a plain `<form action="/search">` and a
    // hand-typed link both land; `query` stays the parameter the page writes.
    query: params.get('query') || params.get('q') || '',
    // A `?genre=` with nothing after it is not a selection.
    genre: genre ? genre : null,
    status: status && STATUS_VALUES.includes(status) ? status : null,
    year: yearParam(params),
    sort: oneOf(params.get('sort'), SORT_KEYS, EMPTY_SEARCH_STATE.sort),
    view: oneOf(params.get('view'), VIEW_MODES, EMPTY_SEARCH_STATE.view),
    hitsPage: pageParam(params, 'page'),
    worksPage: pageParam(params, 'wpage'),
    perPage: PAGE_SIZE_OPTIONS.includes(perPage) ? perPage : EMPTY_SEARCH_STATE.perPage,
  };
}

/**
 * The state written back onto an existing query string.
 *
 * Unrelated parameters are preserved -- campaign tags and the like ride along
 * on shared links, and dropping them on the first chip click would lose them.
 * A default is removed rather than written, so a plain search leaves a clean
 * URL: no `?sort=relevance&view=grid&page=1` on every link.
 */
export function writeSearchUrl(currentSearch: string, next: SearchUrlState): string {
  const params = new URLSearchParams(currentSearch);
  const set = (name: string, value: string | null) => {
    if (value) params.set(name, value);
    else params.delete(name);
  };

  set('query', next.query);
  // The alias never survives a write: one spelling in the address bar.
  params.delete('q');
  set('genre', next.genre);
  set('status', next.status);
  set('year', next.year ? String(next.year) : null);
  set('sort', next.sort !== EMPTY_SEARCH_STATE.sort ? next.sort : null);
  set('view', next.view !== EMPTY_SEARCH_STATE.view ? next.view : null);
  set('page', next.hitsPage > 0 ? String(next.hitsPage + 1) : null);
  set('wpage', next.worksPage > 0 ? String(next.worksPage + 1) : null);
  set('perPage', next.perPage !== EMPTY_SEARCH_STATE.perPage ? String(next.perPage) : null);

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Two states ask the catalogue the same question. The sort and the view are
 * left out: they rearrange what came back without asking for anything new.
 * Used to skip a request that would change nothing.
 */
export function isSameSearch(a: SearchUrlState, b: SearchUrlState): boolean {
  return (
    a.query === b.query &&
    a.genre === b.genre &&
    a.status === b.status &&
    a.year === b.year &&
    a.hitsPage === b.hitsPage &&
    a.worksPage === b.worksPage &&
    a.perPage === b.perPage
  );
}

/** Nothing narrowing the catalogue: the page shows it whole, newest and best first. */
export function isBrowseState(state: SearchUrlState): boolean {
  return !state.query.trim() && !state.genre && !state.status && !state.year;
}

/** A different question starts from the first page of its answer. */
function firstPage(state: SearchUrlState): SearchUrlState {
  return { ...state, hitsPage: 0, worksPage: 0 };
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
  return firstPage({ ...state, query });
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
    return firstPage({ ...state, query: hasDraftQuery ? state.query : '', genre: null });
  }
  return firstPage({ ...state, genre });
}

/** The status or year select. A filter is a new question, so back to page one. */
export function narrow(
  state: SearchUrlState,
  patch: Partial<Pick<SearchUrlState, 'status' | 'year'>>,
): SearchUrlState {
  return firstPage({ ...state, ...patch });
}

/**
 * The pager. A new page size restarts both grids: page 3 of 24-per-page is
 * not page 3 of 100-per-page, and staying would land the reader somewhere
 * they did not ask for.
 */
export function paged(
  state: SearchUrlState,
  patch: Partial<Pick<SearchUrlState, 'hitsPage' | 'worksPage' | 'perPage'>>,
): SearchUrlState {
  if (patch.perPage !== undefined && patch.perPage !== state.perPage) {
    return { ...state, perPage: patch.perPage, hitsPage: 0, worksPage: 0 };
  }
  return { ...state, ...patch };
}

/** The sort and the view: how the answer is laid out, not what was asked. */
export function laidOut(
  state: SearchUrlState,
  patch: Partial<Pick<SearchUrlState, 'sort' | 'view'>>,
): SearchUrlState {
  return { ...state, ...patch };
}

/**
 * "Clear all", and the × on the search field: the whole catalogue again.
 * How the reader likes the page laid out -- sort, view, page size -- is not a
 * filter, and survives.
 */
export function clearSearch(state: SearchUrlState = EMPTY_SEARCH_STATE): SearchUrlState {
  return { ...EMPTY_SEARCH_STATE, sort: state.sort, view: state.view, perPage: state.perPage };
}
