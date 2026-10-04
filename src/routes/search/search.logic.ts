/**
 * The /search page's Algolia contract, as pure functions shared by the server
 * loader and the client bloc.
 *
 * The same request shapes and the same answer parsing on both sides is what
 * keeps the first render (built on the server from `+page.server.ts`) and every
 * later search (run in the browser by the bloc) from drifting apart. Nothing
 * here touches the network or a rune.
 */
import { toGenreFacets, type GenreFacet, type Hit } from './SearchPage.results';
import { readSearchUrl, writeSearchUrl, PAGE_SIZE_OPTIONS, type SearchUrlState } from './SearchPage.urlState';

export { PAGE_SIZE_OPTIONS };

/** Public search-only credentials; the same ones the header autocomplete uses. */
export const ALGOLIA_APP_ID = 'A2HF2P5C6X';
export const ALGOLIA_SEARCH_KEY = '45216ed5ac3f9e0a478d3c354d353d58';
export const ANIME_INDEX_FALLBACK = 'anime-staging';


/** One page of catalogue results, plus the works that matched the same query. */
export interface CatalogSearchRequest {
  query: string;
  /** Zero-based, matching Algolia. Hits are anime; works are manga, light novels and the like. */
  hitsPage: number;
  worksPage: number;
  /**
   * Results per page, for both indices. The two are paged independently but
   * sized together: a page showing 24 anime and 6 manga reads as a bug, not a
   * design, so the size the viewer picks applies to the whole page.
   */
  perPage: number;
  genre: string | null;
  /** One of STATUS_VALUES (CURRENTLY_AIRING, ...), or null for any. */
  status: string | null;
  /** A broadcast year, or null for any. */
  year: number | null;
  /** Works ride along in the same round trip when the query can carry them. */
  includeWorks: boolean;
}

/**
 * The index's label for a run that is over, as MyAnimeList spells it. The
 * only label the filters consult: see `buildFilters`.
 */
export const FINISHED_LABEL = 'Finished Airing';

/**
 * The clock the date filters compare against, in unix seconds, floored to
 * the hour. A filter string that changed every millisecond would defeat
 * Algolia's query cache and the page cache in front of this route; an hour
 * is well inside how precisely a broadcast date is known.
 */
export function filterClock(now: number = Date.now()): number {
  return Math.floor(now / 3_600_000) * 3600;
}

/** Which anime are in play: the genre, the status and the year, as one Algolia filter string. */
export type CatalogFilters = { genre?: string | null; status?: string | null; year?: number | null };

/**
 * The status filter is decided by the dates where the index has them, not by
 * the label.
 *
 * The label is MyAnimeList's, copied at scrape time, and it goes stale: the
 * index carried dozens of "Not yet aired" shows that had started months
 * before, and they vanished from both Airing and Upcoming. The start date is
 * indexed as a number (`date_rank`, unix seconds), so Upcoming is "starts
 * after now" and Airing is "started by now" -- with the one label the
 * catalogue is reliable about, "Finished Airing", ruling out runs that are
 * over. Finished has only the label to go on: the end date is indexed as
 * text, and most records lack one.
 *
 * `now` is a millisecond timestamp, as `Date.now()` gives; tests pass one.
 */
export function buildFilters(f: CatalogFilters, now: number = Date.now()): string | undefined {
  const parts: string[] = [];
  if (f.genre) parts.push(`tags:"${f.genre}"`);
  const clock = filterClock(now);
  switch (f.status) {
    case 'CURRENTLY_AIRING':
      parts.push(`date_rank <= ${clock} AND NOT status:"${FINISHED_LABEL}"`);
      break;
    case 'FINISHED_AIRING':
      parts.push(`status:"${FINISHED_LABEL}"`);
      break;
    case 'NOT_YET_AIRED':
      parts.push(`date_rank > ${clock}`);
      break;
  }
  if (f.year) parts.push(`year:${f.year}`);
  return parts.length ? parts.join(' AND ') : undefined;
}

export interface CatalogSearchResponse {
  hits: Hit[];
  totalHits: number;
  works: Hit[];
  totalWorks: number;
  total: number;
}

export interface AlgoliaIndexes {
  animeIndex: string;
  /** Empty when unconfigured, which is the signal to skip the works request. */
  worksIndex: string;
}

export function indexesFrom(
  config: { algolia_index?: string | null; algolia_works_index?: string | null } | null | undefined
): AlgoliaIndexes {
  return {
    animeIndex: config?.algolia_index || ANIME_INDEX_FALLBACK,
    worksIndex: config?.algolia_works_index || '',
  };
}

/**
 * `algoliasearch/lite` has shipped its factory as a default export, as the
 * module itself, and as `liteClient`, depending on the major version.
 */
export function resolveAlgoliaFactory(module: any): ((appId: string, apiKey: string) => any) | null {
  const candidate =
    typeof module?.default === 'function'
      ? module.default
      : typeof module === 'function'
        ? module
        : module?.liteClient;
  return typeof candidate === 'function' ? candidate : null;
}

/**
 * `tags` is an anime facet that no work carries, so a genre filter and a
 * works request cannot both be honoured in one query.
 */
export function wantsWorks(request: CatalogSearchRequest, indexes: AlgoliaIndexes): boolean {
  return request.includeWorks && !!indexes.worksIndex;
}

export function buildSearchRequests(request: CatalogSearchRequest, indexes: AlgoliaIndexes, now: number = Date.now()): any[] {
  const requests: any[] = [
    {
      indexName: indexes.animeIndex,
      query: request.query,
      hitsPerPage: request.perPage,
      page: request.hitsPage,
      filters: buildFilters(request, now),
    },
  ];
  if (wantsWorks(request, indexes)) {
    requests.push({
      indexName: indexes.worksIndex,
      query: request.query,
      hitsPerPage: request.perPage,
      page: request.worksPage,
    });
  }
  return requests;
}

/** Algolia v5 puts results under `results`; older shapes answer flat. */
export function parseSearchResponse(response: any, wantWorks: boolean): CatalogSearchResponse {
  const first = response?.results?.[0] || response;
  const hits = first?.hits || [];
  const second = wantWorks ? response?.results?.[1] : null;
  const works = second?.hits || [];
  const totalHits = first?.nbHits ?? first?.totalHits ?? hits.length;
  const totalWorks = wantWorks ? (second?.nbHits ?? second?.totalHits ?? 0) : 0;
  return { hits, totalHits, works, totalWorks, total: totalHits + totalWorks };
}

/**
 * The genre browse strip: facet counts over the catalogue, not one page --
 * narrowed by the status and year in play, never by the genre, so every chip
 * still shows what choosing it would give.
 */
export function buildGenreFacetRequest(indexes: AlgoliaIndexes, filters: Omit<CatalogFilters, 'genre'> = {}, now: number = Date.now()): any {
  const f = buildFilters({ status: filters.status, year: filters.year }, now);
  return { indexName: indexes.animeIndex, query: '', hitsPerPage: 0, facets: ['tags'], ...(f ? { filters: f } : {}) };
}

export function parseGenreFacetResponse(response: any): GenreFacet[] {
  const first = response?.results?.[0] || response;
  return toGenreFacets(first?.facets?.tags);
}

/* ── The URL, including paging ───────────────────────────────────────────── */

/** Everything a /search URL asks for. Pages are zero-based here; `?page=` is one-based for people. */
/**
 * Everything the URL says about the page. One type with `SearchUrlState`:
 * the pages and the size used to live only here, and the filters only there,
 * until Back stopped resuming the page the reader had scrolled to.
 */
export type SearchPageParams = SearchUrlState;

export const readSearchParams: (search: string | URLSearchParams) => SearchPageParams = readSearchUrl;

/**
 * A link to this page in the page's own spelling: what the pagers carry so a
 * visitor without a script still gets page two. Defaults stay out of it.
 */
export function searchPageHref(current: SearchPageParams, patch: Partial<SearchPageParams> = {}): string {
  return `/search${writeSearchUrl('', { ...current, ...patch })}`;
}

export function toCatalogRequest(params: SearchPageParams): CatalogSearchRequest {
  const query = params.query.trim();
  return {
    query,
    hitsPage: params.hitsPage,
    worksPage: params.worksPage,
    perPage: params.perPage,
    genre: params.genre,
    status: params.status,
    year: params.year,
    // The works index has none of the anime facets, so a filtered question
    // cannot be put to it: 24 filtered anime beside unfiltered manga reads
    // as a bug. Works ride along only with a plain text search.
    includeWorks: !!query && !params.genre && !params.status && !params.year,
  };
}

/* ── What the loader hands the page ──────────────────────────────────────── */

/**
 * The server's answer for one URL. `results` is null when there was nothing to
 * search (the browse state) or when Algolia could not be reached in time, in
 * which case the bloc searches from the browser as it always did.
 */
export interface SearchPageSeed {
  /** The URL's query string this seed answers, so a stale seed is never adopted. */
  key: string;
  params: SearchPageParams;
  results: CatalogSearchResponse | null;
  genres: GenreFacet[] | null;
}

export { isBrowseState } from './SearchPage.urlState';
