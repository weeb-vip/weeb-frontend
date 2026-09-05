import { fromStore, type Readable } from 'svelte/store';
import { page as pageStore } from '$app/stores';
import { goto } from '$app/navigation';
import { SvelteMap } from 'svelte/reactivity';
import { configStore } from '../stores/config';
import { AuthStorage } from '../../utils/auth-storage';
import { animeHref } from '../../services/utils';
import { workSubtitle } from '../../utils/workDisplay';
import { Status } from '../../gql/graphql';
import {
  filterAndSortHits,
  listExcerpt,
  normalizeHit,
  toGenreFacets,
  yearOptions,
  type GenreFacet,
  type Hit,
  type NormalizedHit,
  type SortKey,
} from './SearchPage.results';
import {
  clearSearch,
  isBrowseState,
  isSameSearch,
  readSearchUrl,
  submitQuery,
  toggleGenre,
  writeSearchUrl,
  type SearchUrlState,
} from './SearchPage.urlState';

/* ── Ports ───────────────────────────────────────────────────────────────── */

/** One page of catalogue results, plus the works that matched the same query. */
export interface CatalogSearchRequest {
  query: string;
  /** Zero-based, matching Algolia. */
  page: number;
  hitsPerPage: number;
  genre: string | null;
  /** Works ride along in the same round trip when the query can carry them. */
  includeWorks: boolean;
}

export interface CatalogSearchResponse {
  hits: Hit[];
  total: number;
  works: Hit[];
}

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
  /** The genre browse strip. Facet counts over the whole index, not one page. */
  genreFacets(): Promise<GenreFacet[]>;
}

/** The viewer's list, as a lookup from anime id to the status they gave it. */
export interface UserListPort {
  load(): Promise<Map<string, string>>;
}

/**
 * The address bar. The page reads its query and genre from it and writes them
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

const ANIME_INDEX_FALLBACK = 'anime-staging';
const WORKS_HITS_PER_PAGE = 6;

/** The real Algolia stack: lazily imported, configured from the config store. */
export const algoliaCatalogSearchPort: CatalogSearchPort = {
  async search(request) {
    const client = await getClient();
    if (!client) return { hits: [], total: 0, works: [] };

    const { searchClient, animeIndex, worksIndex } = client;
    // `tags` is an anime facet that no work carries, so a genre filter and a
    // works request cannot both be honoured in one query.
    const wantWorks = request.includeWorks && !!worksIndex;

    const requests: any[] = [
      {
        indexName: animeIndex,
        query: request.query,
        hitsPerPage: request.hitsPerPage,
        page: request.page,
        filters: request.genre ? `tags:"${request.genre}"` : undefined,
      },
    ];
    if (wantWorks) {
      requests.push({
        indexName: worksIndex,
        query: request.query,
        hitsPerPage: WORKS_HITS_PER_PAGE,
      });
    }

    const response = await searchClient.search({ requests });
    // Algolia v5 puts results under `results`; older shapes answer flat.
    const first = response.results?.[0] || response;
    const hits = first?.hits || [];

    return {
      hits,
      total: first?.nbHits ?? first?.totalHits ?? hits.length,
      works: wantWorks ? response.results?.[1]?.hits || [] : [],
    };
  },

  async genreFacets() {
    const client = await getClient();
    if (!client) return [];

    const response = await client.searchClient.search({
      requests: [
        {
          indexName: client.animeIndex,
          query: '',
          hitsPerPage: 0,
          facets: ['tags'],
        },
      ],
    });

    return toGenreFacets(response.results?.[0]?.facets?.tags);
  },
};

type AlgoliaClient = { searchClient: any; animeIndex: string; worksIndex: string };
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
    const algoliasearch =
      typeof module?.default === 'function'
        ? module.default
        : typeof module === 'function'
          ? module
          : module?.liteClient;

    if (typeof algoliasearch !== 'function') {
      throw new Error('Unable to find algoliasearch function in module');
    }

    const config = configStore.get();

    return {
      searchClient: algoliasearch('A2HF2P5C6X', '45216ed5ac3f9e0a478d3c354d353d58'),
      animeIndex: config?.algolia_index || ANIME_INDEX_FALLBACK,
      // Empty when unconfigured, which is the signal to skip the works request
      // entirely rather than query an index that may not exist.
      worksIndex: config?.algolia_works_index || '',
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

    const { ensureConfigLoaded } = await import('../../services/config-loader');
    await ensureConfigLoaded();
    const { AuthenticatedClient } = await import('../../services/queries');
    const { queryUserAnimes } = await import('../../services/api/graphql/queries');
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

export const PAGE_SIZE_OPTIONS = [24, 48, 72, 100];

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

export type ViewMode = 'grid' | 'list';

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
}

/* ── Bloc ────────────────────────────────────────────────────────────────── */

/**
 * The /search page: what is being searched, what came back, and how it is
 * narrowed and paged.
 *
 * The state splits three ways and the split is the whole design.
 *
 *  - **URL-backed**: the query and the genre. Handlers never assign these; they
 *    write a URL and `syncFromUrl()` derives them once the navigation lands.
 *    See `SearchPage.urlState.ts`.
 *  - **Local**: status, year, sort and view mode. These narrow the page that is
 *    already on screen, so they are instant and not worth a history entry.
 *  - **Fetched**: the results, the facet strip and the viewer's list.
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

  /** The text in the box, which is not yet the text that was searched for. */
  #draftQuery = $state('');
  #urlState = $state<SearchUrlState>({ query: '', genre: null });

  #results = $state<NormalizedHit[]>([]);
  #workResults = $state<Hit[]>([]);
  #total = $state(0);
  #currentPage = $state(0);
  #perPage = $state(PAGE_SIZE_OPTIONS[0]);
  #isLoading = $state(false);
  #hasSearched = $state(false);

  #status = $state('');
  #year = $state('');
  #sort = $state<SortKey>('relevance');
  #viewMode = $state<ViewMode>('grid');

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
  }: SearchPageDeps = {}) {
    this.#search = search;
    this.#userList = userList;
    this.#route = route;
    this.#pathname = pathname;
    this.#url = fromStore(route.url);
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

  get totalResults(): number {
    return this.#total;
  }

  get page(): number {
    return this.#currentPage;
  }

  get perPage(): number {
    return this.#perPage;
  }

  get totalPages(): number {
    return Math.ceil(this.#total / this.#perPage);
  }

  get viewMode(): ViewMode {
    return this.#viewMode;
  }

  get status(): string {
    return this.#status;
  }

  get year(): string {
    return this.#year;
  }

  get sort(): SortKey {
    return this.#sort;
  }

  get isLoadingGenres(): boolean {
    return this.#isLoadingGenres;
  }

  get showAllGenres(): boolean {
    return this.#showAllGenres;
  }

  /** The chips on screen: the busiest genres first, the rest behind "+N more". */
  get visibleGenres(): GenreFacet[] {
    return this.#showAllGenres
      ? this.#browseGenres
      : this.#browseGenres.slice(0, INITIAL_GENRE_COUNT);
  }

  get hiddenGenreCount(): number {
    return Math.max(0, this.#browseGenres.length - INITIAL_GENRE_COUNT);
  }

  get hasGenres(): boolean {
    return this.#browseGenres.length > 0;
  }

  isGenreSelected(name: string): boolean {
    return this.#urlState.genre === name;
  }

  readonly #filteredResults: NormalizedHit[] = $derived(
    filterAndSortHits(this.#results, {
      genre: this.#urlState.genre,
      status: this.#status,
      year: this.#year,
      sort: this.#sort,
    }),
  );

  get results(): NormalizedHit[] {
    return this.#filteredResults;
  }

  /**
   * A work is reachable only by slug -- workBySlug is the only lookup the schema
   * exposes, and there is no id route to fall back on the way anime have. One
   * without a slug would render a card leading to a certain 404, so it is left
   * out rather than shown.
   */
  get works(): Hit[] {
    return this.#workResults.filter((work) => !!work?.slug);
  }

  get hasResults(): boolean {
    return this.#filteredResults.length > 0;
  }

  /** The state the page is in, so the view has one thing to switch on. */
  get phase(): 'loading' | 'empty' | 'results' | 'browse' {
    if (this.#isLoading) return 'loading';
    if (!this.#hasSearched) return 'browse';
    return this.hasResults ? 'results' : 'empty';
  }

  /** "1,204 results for 'naruto'" -- assembled here so the markup has one string. */
  get resultsSummary(): string {
    const count = `${this.#total.toLocaleString()} ${this.#total === 1 ? 'result' : 'results'}`;
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
    const genre = this.#urlState.genre;
    if (genre) {
      out.push({ key: `genre:${genre}`, label: genre, remove: () => this.toggleGenre(genre) });
    }
    if (this.#status) {
      const label = STATUS_FILTERS.find((s) => s.value === this.#status)?.label ?? this.#status;
      out.push({ key: 'status', label, remove: () => this.setStatus('') });
    }
    if (this.#year) {
      out.push({ key: 'year', label: this.#year, remove: () => this.setYear('') });
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
    void this.#loadGenres();

    this.#urlState = readSearchUrl(this.#url.current.search);
    this.#draftQuery = this.#urlState.query;
    this.#lastSeenSearch = this.#url.current.search;

    if (!isBrowseState(this.#urlState)) await this.#runSearch();
  }

  /**
   * Called from an effect in the view on every URL change. The URL is the
   * source of truth, so this is the only place query and genre are assigned.
   */
  syncFromUrl(): void {
    // Read first, always: this is what subscribes the caller's effect to the
    // URL. Bailing out before the read would leave the effect tracking nothing
    // and never running again.
    const { pathname, search } = this.#url.current;
    if (!this.#initialized) return;
    if (pathname !== this.#pathname) return;
    if (search === this.#lastSeenSearch) return;

    this.#lastSeenSearch = search;
    const next = readSearchUrl(search);
    if (isSameSearch(next, this.#urlState) && this.#hasSearched) return;

    this.#urlState = next;
    this.#draftQuery = next.query;
    void this.#runSearch();
  }

  /** Commit whatever is in the box. A blank submission is a no-op. */
  submit(): void {
    const next = submitQuery(this.#urlState, this.#draftQuery);
    if (next) this.#applyUrl(next);
  }

  /** The × on the field, and "Clear all": back to the browse placeholder. */
  clear(): void {
    this.#draftQuery = '';
    this.#status = '';
    this.#year = '';
    this.#applyUrl(clearSearch());
  }

  toggleGenre(genre: string): void {
    this.#applyUrl(toggleGenre(this.#urlState, genre, { hasDraftQuery: !!this.#draftQuery }));
  }

  revealAllGenres(): void {
    this.#showAllGenres = true;
  }

  setViewMode(mode: string): void {
    this.#viewMode = mode as ViewMode;
  }

  /** Local filters: they narrow the page already on screen, so no navigation. */
  setStatus(value: string | number): void {
    this.#status = String(value);
  }

  setYear(value: string | number): void {
    this.#year = String(value);
  }

  setSort(value: string | number): void {
    this.#sort = String(value) as SortKey;
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.#currentPage = page;
    void this.#runSearch({ resetPage: false });
  }

  setPerPage(perPage: number): void {
    this.#perPage = perPage;
    this.#currentPage = 0;
    void this.#runSearch({ resetPage: false });
  }

  /* ── Internals ─────────────────────────────────────────────────────────── */

  #applyUrl(next: SearchUrlState): void {
    this.#route.replace(writeSearchUrl(this.#url.current.search, next));
  }

  async #runSearch({ resetPage = true }: { resetPage?: boolean } = {}): Promise<void> {
    if (isBrowseState(this.#urlState)) {
      this.#results = [];
      this.#workResults = [];
      this.#hasSearched = false;
      this.#total = 0;
      this.#currentPage = 0;
      return;
    }

    if (resetPage) this.#currentPage = 0;

    const seq = ++this.#requestSeq;
    this.#isLoading = true;
    this.#hasSearched = true;

    try {
      const response = await this.#search.search({
        query: this.#urlState.query.trim(),
        page: this.#currentPage,
        hitsPerPage: this.#perPage,
        genre: this.#urlState.genre,
        // Works are skipped under a genre filter, because `tags` is an anime
        // facet no work carries, and on later pages, because pagination walks
        // the anime results and a repeated works section under page 4 is noise.
        includeWorks:
          !!this.#urlState.query.trim() && !this.#urlState.genre && this.#currentPage === 0,
      });

      if (seq !== this.#requestSeq) return;

      this.#results = response.hits.map(normalizeHit);
      this.#workResults = response.works;
      this.#total = response.total;
    } catch (error) {
      if (seq !== this.#requestSeq) return;
      console.error('Search failed:', error);
      this.#results = [];
      this.#workResults = [];
      this.#total = 0;
    } finally {
      if (seq === this.#requestSeq) this.#isLoading = false;
    }
  }

  async #loadGenres(): Promise<void> {
    this.#isLoadingGenres = true;
    try {
      this.#browseGenres = await this.#search.genreFacets();
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
