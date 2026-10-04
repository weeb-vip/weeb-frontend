import { fromStore, type Readable } from 'svelte/store';
import { page as pageStore } from '$app/stores';
import { goto } from '$app/navigation';
import { SvelteMap } from 'svelte/reactivity';
import { configStore } from '$lib/stores/config';
import { AuthStorage } from '$lib/utils/auth-storage';
import { animeHref } from '$lib/services/utils';
import { workSubtitle } from '$lib/utils/workDisplay';
import { Status } from '../../gql/graphql';
import {
  filterAndSortHits,
  listExcerpt,
  normalizeHit,
  yearOptions,
  type GenreFacet,
  type Hit,
  type NormalizedHit,
  type SortKey,
} from './SearchPage.results';
import {
  buildGenreFacetRequest,
  buildSearchRequests,
  indexesFrom,
  parseGenreFacetResponse,
  parseSearchResponse,
  resolveAlgoliaFactory,
  searchPageHref,
  wantsWorks,
  ALGOLIA_APP_ID,
  ALGOLIA_SEARCH_KEY,
  PAGE_SIZE_OPTIONS,
  type AlgoliaIndexes,
  type CatalogSearchRequest,
  type CatalogSearchResponse,
  type SearchPageSeed,
} from './search.logic';

export { PAGE_SIZE_OPTIONS };
export type { CatalogSearchRequest, CatalogSearchResponse, SearchPageSeed };
import {
  clearSearch,
  isSameSearch,
  laidOut,
  narrow,
  paged,
  readSearchUrl,
  submitQuery,
  toggleGenre,
  writeSearchUrl,
  EMPTY_SEARCH_STATE,
  STATUS_VALUES,
  type SearchUrlState,
  type ViewMode,
} from './SearchPage.urlState';
export type { ViewMode };

/* ── Ports ───────────────────────────────────────────────────────────────── */

/**
 * Where results come from.
 *
 * Deliberately NOT `AutocompleteAdvanced`'s `SearchPort`. That one wraps
 * autocomplete-core -- a session you push keystrokes into and read a
 * `{query,isOpen,collections}` state back from -- which is the right shape for
 * a typeahead panel and the wrong one here: this page asks for a specific page
 * of a specific query with a facet filter, and separately for facet counts.
 * Sharing the interface would mean one of the two callers passing arguments the
 * other ignores. The Algolia *client* is the thing worth sharing, and both
 * ports build one the same way.
 */
export interface CatalogSearchPort {
  search(request: CatalogSearchRequest): Promise<CatalogSearchResponse>;
  /** The genre browse strip: counts over the catalogue under the status and year in play. */
  genreFacets(filters?: { status: string | null; year: number | null }): Promise<GenreFacet[]>;
}

/** The viewer's list, as a lookup from anime id to the status they gave it. */
export interface UserListPort {
  load(): Promise<Map<string, string>>;
}

/**
 * The address bar. The page reads everything it shows from it and writes it
 * back, so both halves are one dependency -- a story hands over a plain store
 * and a spy, and the whole URL cycle runs with no router.
 */
export interface RoutePort {
  url: Readable<{ pathname: string; search: string }>;
  /**
   * Must be a real navigation, not `replaceState`. `replaceState` from
   * $app/navigation is shallow routing: it swaps the history entry and sets
   * `page.state`, but leaves `page.url` pointing at the old URL -- so the sync
   * below would never see the new query, and would "correct" the state back to
   * the stale URL, wiping the selection that was just made.
   */
  replace(search: string): void;
}

/**
 * The real Algolia stack: lazily imported, configured from the config store.
 * Requests and parsing come from `search.logic`, the same module the server
 * loader uses for the first render, so a search run here answers exactly what
 * the HTML already showed.
 */
export const algoliaCatalogSearchPort: CatalogSearchPort = {
  async search(request) {
    const client = await getClient();
    if (!client) return { hits: [], totalHits: 0, works: [], totalWorks: 0, total: 0 };

    const requests = buildSearchRequests(request, client);
    const response = await client.searchClient.search({ requests });
    return parseSearchResponse(response, wantsWorks(request, client));
  },

  async genreFacets(filters = { status: null, year: null }) {
    const client = await getClient();
    if (!client) return [];

    const response = await client.searchClient.search({ requests: [buildGenreFacetRequest(client, filters)] });
    return parseGenreFacetResponse(response);
  },
};

type AlgoliaClient = AlgoliaIndexes & { searchClient: any };
let clientPromise: Promise<AlgoliaClient | null> | null = null;

/** One client per browser session; both port methods share it. */
function getClient(): Promise<AlgoliaClient | null> {
  if (!clientPromise) clientPromise = createClient();
  return clientPromise;
}

async function createClient(): Promise<AlgoliaClient | null> {
  if (typeof window === 'undefined') return null;

  try {
    await configStore.init();
  } catch (error) {
    console.error('Config init failed:', error);
  }

  try {
    const module: any = await import('algoliasearch/lite');
    const algoliasearch = resolveAlgoliaFactory(module);
    if (!algoliasearch) {
      throw new Error('Unable to find algoliasearch function in module');
    }

    return {
      searchClient: algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY),
      ...indexesFrom(configStore.get()),
    };
  } catch (error) {
    console.error('Algolia init failed:', error);
    return null;
  }
}

/** The signed-in viewer's anime list, one request per status. */
export const graphqlUserListPort: UserListPort = {
  async load() {
    if (!AuthStorage.isLoggedIn()) return new Map();

    const { ensureConfigLoaded } = await import('$lib/services/config-loader');
    await ensureConfigLoaded();
    const { AuthenticatedClient } = await import('$lib/services/query-options');
    const { queryUserAnimes } = await import('$lib/services/api/graphql/queries');
    const client = await AuthenticatedClient();

    const statuses = [
      Status.Watching,
      Status.Completed,
      Status.Plantowatch,
      Status.Dropped,
      Status.Onhold,
    ];
    const responses = await Promise.all(
      statuses.map((status) =>
        client
          .request(queryUserAnimes, { input: { status, limit: 1000, page: 1 } })
          .then((r: any) => r.UserAnimes?.animes || [])
          .catch(() => []),
      ),
    );

    const map = new Map<string, string>();
    responses.forEach((animes: any[], i) => {
      animes.forEach((entry: any) => {
        if (entry.anime?.id) map.set(entry.anime.id, statuses[i]);
      });
    });

    return map;
  },
};

/* ── Constants the view renders ──────────────────────────────────────────── */

export const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'CURRENTLY_AIRING', label: 'Airing' },
  { value: 'FINISHED_AIRING', label: 'Finished' },
  { value: 'NOT_YET_AIRED', label: 'Upcoming' },
];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'score', label: 'Score' },
  { value: 'newest', label: 'Newest' },
  { value: 'title', label: 'A-Z' },
];

/** How many genre chips the strip shows before the "+N more" chip. */
export const INITIAL_GENRE_COUNT = 12;

/** One pill in the active-filters row, and what removing it does. */
export interface ActiveFilter {
  key: string;
  label: string;
  remove: () => void;
}

export interface SearchPageDeps {
  search?: CatalogSearchPort;
  userList?: UserListPort;
  route?: RoutePort;
  /** The page the browse strip lives on. Only /search syncs from the URL. */
  pathname?: string;
  /**
   * What the server already answered for the current URL (`+page.server.ts`).
   * Read through a getter so a navigation that brings new page data is seen.
   * Null where there is no loader -- a story, or the browse strip on another
   * page -- in which case everything is fetched from the browser as before.
   */
  source?: () => SearchPageSeed | null;
}

/* ── Bloc ────────────────────────────────────────────────────────────────── */

/**
 * The /search page: what is being searched, what came back, and how it is
 * narrowed, sorted and paged.
 *
 * The state splits two ways and the split is the whole design.
 *
 *  - **URL-backed**: everything the reader chose -- query, genre, status,
 *    year, sort, view, pages, page size. Handlers never assign these; they
 *    write a URL and `syncFromUrl()` derives them once the navigation lands.
 *    That is what makes Back and reload resume the page as it was. See
 *    `SearchPage.urlState.ts`. The sort and the view are also applied on the
 *    spot, because they rearrange what is on screen without asking the
 *    catalogue for anything, and a dropdown that answers a beat later feels
 *    broken.
 *  - **Fetched**: the results, the facet strip and the viewer's list.
 *
 * There is always something on screen: a URL that narrows nothing shows the
 * whole catalogue, best first, rather than a placeholder asking to be typed
 * into.
 */
export class SearchPageBloc {
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statusFilters = STATUS_FILTERS;
  readonly sortOptions = SORT_OPTIONS;

  readonly #search: CatalogSearchPort;
  readonly #userList: UserListPort;
  readonly #route: RoutePort;
  readonly #pathname: string;
  readonly #url: { current: { pathname: string; search: string } };
  readonly #source: () => SearchPageSeed | null;
  /** The `key` of the seed most recently adopted, so one is never adopted twice. */
  #seedKey: string | null = null;

  /** The text in the box, which is not yet the text that was searched for. */
  #draftQuery = $state('');
  #urlState = $state<SearchUrlState>({ ...EMPTY_SEARCH_STATE });

  #hits = $state<NormalizedHit[]>([]);
  #works = $state<Hit[]>([]);
  #totalHits = $state(0);
  #totalWorks = $state(0);
  #isLoading = $state(false);
  #hasSearched = $state(false);

  #browseGenres = $state<GenreFacet[]>([]);
  #isLoadingGenres = $state(true);
  #showAllGenres = $state(false);

  readonly #userAnimeMap = new SvelteMap<string, string>();

  /**
   * The last URL this bloc acted on.
   *
   * Do NOT advance it from a handler ahead of the navigation: the sync runs
   * while the store may still hold the previous URL, and a pre-advanced value
   * makes it "correct" the state back to that stale URL, wiping the selection
   * that was just made.
   */
  #lastSeenSearch: string | null = null;
  #initialized = false;
  /** Guards against a stale response from a superseded query overwriting a newer one. */
  #requestSeq = 0;

  constructor({
    search = algoliaCatalogSearchPort,
    userList = graphqlUserListPort,
    route = {
      url: {
        subscribe: (run) =>
          pageStore.subscribe((value) => run({ pathname: value.url.pathname, search: value.url.search })),
      },
      replace: (search) => {
        goto(`${window.location.pathname}${search}`, {
          replaceState: true,
          noScroll: true,
          keepFocus: true,
        });
      },
    },
    pathname = '/search',
    source = () => null,
  }: SearchPageDeps = {}) {
    this.#search = search;
    this.#userList = userList;
    this.#route = route;
    this.#pathname = pathname;
    this.#url = fromStore(route.url);
    this.#source = source;
    // In the constructor rather than init(): init() runs on the client only,
    // and the server's render has to carry the results it already has.
    this.adoptSeed();
  }

  /**
   * Take the server's answer for the current URL, when there is a new one.
   * Called by the view whenever the page data changes, and by the constructor
   * for the first render. A seed for a URL other than the one on screen is
   * left alone: the URL is the source of truth, and syncFromUrl() will ask
   * for it when the navigation lands.
   */
  adoptSeed(): void {
    const seed = this.#source();
    if (!seed || seed.key === this.#seedKey) return;
    if (seed.key !== this.#url.current.search) return;
    this.#seedKey = seed.key;

    if (seed.genres) {
      this.#browseGenres = seed.genres;
      this.#isLoadingGenres = false;
    }

    // A seed with no results (Algolia was slow or down on the server) is left
    // for the browser: init()/syncFromUrl() read the URL and search as they
    // always did. Only a full answer moves the state, or the sync that follows
    // would see nothing to do.
    if (!seed.results) return;
    this.#lastSeenSearch = seed.key;
    this.#urlState = { ...seed.params };
    this.#draftQuery = seed.params.query;
    this.#hits = seed.results.hits.map(normalizeHit);
    this.#works = seed.results.works;
    this.#totalHits = seed.results.totalHits;
    this.#totalWorks = seed.results.totalWorks;
    this.#hasSearched = true;
    this.#isLoading = false;
  }

  /** Whether the server answered the search the current URL names. */
  get #seededForCurrentUrl(): boolean {
    const seed = this.#source();
    return !!seed && seed.key === this.#seedKey && seed.key === this.#url.current.search && !!seed.results;
  }

  /* ── Reads ─────────────────────────────────────────────────────────────── */

  get draftQuery(): string {
    return this.#draftQuery;
  }

  set draftQuery(value: string) {
    this.#draftQuery = value;
  }

  get committedQuery(): string {
    return this.#urlState.query;
  }

  get selectedGenre(): string | null {
    return this.#urlState.genre;
  }

  get isLoading(): boolean {
    return this.#isLoading;
  }

  get hasSearched(): boolean {
    return this.#hasSearched;
  }

  get totalHits(): number {
    return this.#totalHits;
  }

  get totalWorks(): number {
    return this.#totalWorks;
  }

  get hitsPage(): number {
    return this.#urlState.hitsPage;
  }

  get worksPage(): number {
    return this.#urlState.worksPage;
  }

  get hitsPerPage(): number {
    return this.#urlState.perPage;
  }

  get worksPerPage(): number {
    return this.#urlState.perPage;
  }

  get totalHitsPages(): number {
    return Math.ceil(this.#totalHits / this.#urlState.perPage);
  }

  get totalWorksPages(): number {
    return Math.ceil(this.#totalWorks / this.#urlState.perPage);
  }

  get viewMode(): ViewMode {
    return this.#urlState.view;
  }

  /** As the select wants it: '' for any. */
  get status(): string {
    return this.#urlState.status ?? '';
  }

  /** As the select wants it: '' for any. */
  get year(): string {
    return this.#urlState.year ? String(this.#urlState.year) : '';
  }

  get sort(): SortKey {
    return this.#urlState.sort;
  }

  get isLoadingGenres(): boolean {
    return this.#isLoadingGenres;
  }

  get showAllGenres(): boolean {
    return this.#showAllGenres;
  }

  /**
   * The chips on screen: the busiest genres first, the rest behind "+N more".
   * The selected genre is always among them. A navigation rebuilds the strip
   * from the server's seed, and a filter the visitor just chose from behind
   * "+N more" must not vanish back behind it.
   */
  get visibleGenres(): GenreFacet[] {
    if (this.#showAllGenres) return this.#browseGenres;
    const head = this.#browseGenres.slice(0, INITIAL_GENRE_COUNT);
    const selected = this.#urlState.genre;
    if (!selected || head.some((g) => g.name === selected)) return head;
    const chosen = this.#browseGenres.find((g) => g.name === selected);
    return chosen ? [...head, chosen] : head;
  }

  /** How many "+N more" would reveal. Unchanged by the reveal itself: the view drops the chip on `showAllGenres`. */
  get hiddenGenreCount(): number {
    const head = this.#browseGenres.slice(0, INITIAL_GENRE_COUNT);
    const selected = this.#urlState.genre;
    const pinned = selected && !head.some((g) => g.name === selected) && this.#browseGenres.some((g) => g.name === selected) ? 1 : 0;
    return Math.max(0, this.#browseGenres.length - INITIAL_GENRE_COUNT - pinned);
  }

  get hasGenres(): boolean {
    return this.#browseGenres.length > 0;
  }

  isGenreSelected(name: string): boolean {
    return this.#urlState.genre === name;
  }

  readonly #filteredHits: NormalizedHit[] = $derived(
    filterAndSortHits(this.#hits, { genre: this.#urlState.genre, sort: this.#urlState.sort }),
  );

  get results(): NormalizedHit[] {
    return this.#filteredHits;
  }

  /**
   * A work is reachable only by slug -- workBySlug is the only lookup the schema
   * exposes, and there is no id route to fall back on the way anime have. One
   * without a slug would render a card leading to a certain 404, so it is left
   * out rather than shown.
   */
  get works(): Hit[] {
    return this.#works.filter((work) => !!work?.slug);
  }

  get hasResults(): boolean {
    return this.#filteredHits.length > 0;
  }

  /**
   * The state the page is in, so the view has one thing to switch on. Before
   * the first answer it is loading, not blank: there is always a search on
   * the way, even for a URL that asks for nothing in particular.
   */
  get phase(): 'loading' | 'empty' | 'results' {
    if (this.#isLoading || !this.#hasSearched) return 'loading';
    return this.hasResults ? 'results' : 'empty';
  }

  /** "1,204 results for 'naruto'" -- assembled here so the markup has one string. (anime) */
  get hitsSummary(): string {
    const count = `${this.#totalHits.toLocaleString()} ${this.#totalHits === 1 ? 'result' : 'results'}`;
    if (this.#urlState.query) return `${count} for '${this.#urlState.query}'`;
    if (this.#urlState.genre) return `${count} in ${this.#urlState.genre}`;
    return count;
  }

  /** "18 results for 'one piece'" -- assembled here so the markup has one string. (manga) */
  get worksSummary(): string {
    const count = `${this.#totalWorks.toLocaleString()} ${this.#totalWorks === 1 ? 'result' : 'results'}`;
    if (this.#urlState.query) return `${count} for '${this.#urlState.query}'`;
    if (this.#urlState.genre) return `${count} in ${this.#urlState.genre}`;
    return count;
  }

  get yearSelectOptions(): { value: string; label: string }[] {
    return [
      { value: '', label: 'All years' },
      ...yearOptions().map((year) => ({ value: String(year), label: String(year) })),
    ];
  }

  /** Every filter currently narrowing the page, each with the way to drop it. */
  get activeFilters(): ActiveFilter[] {
    const out: ActiveFilter[] = [];
    const { genre, status, year } = this.#urlState;
    if (genre) {
      out.push({ key: `genre:${genre}`, label: genre, remove: () => this.toggleGenre(genre) });
    }
    if (status) {
      const label = STATUS_FILTERS.find((s) => s.value === status)?.label ?? status;
      out.push({ key: 'status', label, remove: () => this.setStatus('') });
    }
    if (year) {
      out.push({ key: 'year', label: String(year), remove: () => this.setYear('') });
    }
    return out;
  }

  get hasActiveFilters(): boolean {
    return this.activeFilters.length > 0;
  }

  /* ── Row helpers ───────────────────────────────────────────────────────── */

  /**
   * Algolia records are the CDC payload verbatim, so the slug arrives as
   * url_slug rather than the camelCase the GraphQL types use.
   */
  hrefFor(hit: Hit): string {
    return animeHref({ id: hit?.id, slug: hit?.url_slug ?? hit?.slug });
  }

  workHref(work: Hit): string {
    return `/manga/${work.slug}`;
  }

  workSubtitle(work: Hit): string {
    return workSubtitle(work?.type, work?.published_from);
  }

  excerpt(description: string | null | undefined): string {
    return listExcerpt(description);
  }

  /** The status the viewer gave this anime, or null when it is not on their list. */
  listStatusFor(hit: Hit): string | null {
    return this.#userAnimeMap.get(hit?.id) ?? null;
  }

  /**
   * A link to another page of the current search: what the pagers carry so a
   * visitor without a script still gets page two. With a script the pager's
   * click handler takes over and pages in place, as it always has.
   */
  hrefForPage(page: number, type: 'hits' | 'works'): string {
    return searchPageHref(this.#urlState, type === 'hits' ? { hitsPage: page } : { worksPage: page });
  }

  /* ── Intents ───────────────────────────────────────────────────────────── */

  /**
   * Connect to search and read the first URL. Idempotent; called once from the
   * view's onMount, and safe to await.
   */
  async init(): Promise<void> {
    if (this.#initialized) return;
    this.#initialized = true;

    // Not awaited: the list only decorates cards, and blocking the first
    // search on a five-request round trip is the wrong trade.
    void this.#loadUserList();

    // The server already answered this URL: nothing to fetch.
    if (this.#seededForCurrentUrl) {
      if (this.#browseGenres.length === 0) void this.#loadGenres();
      return;
    }

    this.#urlState = readSearchUrl(this.#url.current.search);
    this.#draftQuery = this.#urlState.query;
    this.#lastSeenSearch = this.#url.current.search;

    if (this.#browseGenres.length === 0) void this.#loadGenres();
    await this.#runSearch();
  }

  /**
   * Called from an effect in the view on every URL change. The URL is the
   * source of truth, so this is the only place the chosen state is assigned.
   */
  syncFromUrl(): void {
    // Read first, always: this is what subscribes the caller's effect to the
    // URL. Bailing out before the read would leave the effect tracking nothing
    // and never running again.
    const { pathname, search } = this.#url.current;
    if (!this.#initialized) return;
    if (pathname !== this.#pathname) return;
    if (search === this.#lastSeenSearch) return;

    // A navigation that brought the server's answer with it needs no request.
    const seed = this.#source();
    if (seed && seed.key === search && seed.key !== this.#seedKey) {
      this.adoptSeed();
      if (this.#seededForCurrentUrl) return;
    }

    this.#lastSeenSearch = search;
    const previous = this.#urlState;
    const next = readSearchUrl(search);
    this.#urlState = next;
    this.#draftQuery = next.query;

    // The sort or the view alone: the answer on screen is still the answer.
    if (isSameSearch(previous, next) && this.#hasSearched) return;

    void this.#runSearch();
    // The strip counts under the status and year in play; a genre change
    // never moves it, so it is not re-asked for every search.
    if (previous.status !== next.status || previous.year !== next.year) void this.#loadGenres();
  }

  /** Commit whatever is in the box. A blank submission is a no-op. */
  submit(): void {
    const next = submitQuery(this.#urlState, this.#draftQuery);
    if (next) this.#applyUrl(next);
  }

  /** The × on the field, and "Clear all": the whole catalogue again. */
  clear(): void {
    this.#draftQuery = '';
    this.#applyUrl(clearSearch(this.#urlState));
  }

  toggleGenre(genre: string): void {
    this.#applyUrl(toggleGenre(this.#urlState, genre, { hasDraftQuery: !!this.#draftQuery }));
  }

  revealAllGenres(): void {
    this.#showAllGenres = true;
  }

  /**
   * Status and year are query filters: the results, their total and the
   * genre counts all narrow to them. They used to narrow only the page on
   * screen, which left the total, the pager and every genre count describing
   * a different catalogue from the one in the grid. In the URL, so a reload
   * or Back keeps them; the navigation re-asks the catalogue.
   */
  setStatus(value: string | number): void {
    const status = STATUS_VALUES.includes(String(value)) ? String(value) : null;
    if (status === this.#urlState.status) return;
    this.#applyUrl(narrow(this.#urlState, { status }));
  }

  setYear(value: string | number): void {
    const n = Number.parseInt(String(value), 10);
    const year = Number.isFinite(n) ? n : null;
    if (year === this.#urlState.year) return;
    this.#applyUrl(narrow(this.#urlState, { year }));
  }

  /**
   * The sort and the view rearrange what is already on screen, so they are
   * applied on the spot as well as written to the URL -- a dropdown that only
   * answered once a navigation landed would feel broken. The sync that
   * follows reads the same values back and asks the catalogue nothing.
   */
  setSort(value: string | number): void {
    this.#layOut({ sort: String(value) as SortKey });
  }

  setViewMode(mode: string): void {
    this.#layOut({ view: mode as ViewMode });
  }

  goToPage(page: number, type: 'hits' | 'works'): void {
    if (page < 0 || page >= (type === 'hits' ? this.totalHitsPages : this.totalWorksPages)) return;
    this.#applyUrl(paged(this.#urlState, type === 'hits' ? { hitsPage: page } : { worksPage: page }));
  }

  /** One size for both grids, so both restart at their first page. */
  setHitsPerPage(perPage: number): void {
    this.#applyUrl(paged(this.#urlState, { perPage }));
  }

  /* ── Internals ─────────────────────────────────────────────────────────── */

  #applyUrl(next: SearchUrlState): void {
    this.#route.replace(writeSearchUrl(this.#url.current.search, next));
  }

  #layOut(patch: Partial<Pick<SearchUrlState, 'sort' | 'view'>>): void {
    const next = laidOut(this.#urlState, patch);
    if (next.sort === this.#urlState.sort && next.view === this.#urlState.view) return;
    this.#urlState = next;
    this.#applyUrl(next);
  }

  async #runSearch(): Promise<void> {
    const state = this.#urlState;
    const seq = ++this.#requestSeq;
    this.#isLoading = true;
    this.#hasSearched = true;

    try {
      const query = state.query.trim();
      const response = await this.#search.search({
        query,
        hitsPage: state.hitsPage,
        worksPage: state.worksPage,
        perPage: state.perPage,
        genre: state.genre,
        status: state.status,
        year: state.year,
        includeWorks: !!query && !state.genre && !state.status && !state.year,
      });

      if (seq !== this.#requestSeq) return;

      this.#hits = response.hits.map(normalizeHit);
      this.#works = response.works;
      this.#totalHits = response.totalHits;
      this.#totalWorks = response.totalWorks;
    } catch (error) {
      if (seq !== this.#requestSeq) return;
      console.error('Search failed:', error);
      this.#hits = [];
      this.#works = [];
      this.#totalHits = 0;
      this.#totalWorks = 0;
    } finally {
      if (seq === this.#requestSeq) this.#isLoading = false;
    }
  }

  async #loadGenres(): Promise<void> {
    this.#isLoadingGenres = true;
    try {
      this.#browseGenres = await this.#search.genreFacets({ status: this.#urlState.status, year: this.#urlState.year });
    } catch (error) {
      console.error('Failed to fetch genres:', error);
      this.#browseGenres = [];
    }
    this.#isLoadingGenres = false;
  }

  async #loadUserList(): Promise<void> {
    try {
      const map = await this.#userList.load();
      this.#userAnimeMap.clear();
      for (const [id, status] of map) this.#userAnimeMap.set(id, status);
    } catch (error) {
      console.error('Failed to fetch user anime map:', error);
    }
  }
}
