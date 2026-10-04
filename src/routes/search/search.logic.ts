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
import { readSearchUrl, writeSearchUrl, isBrowseState, type SearchUrlState } from './SearchPage.urlState';

/** Public search-only credentials; the same ones the header autocomplete uses. */
export const ALGOLIA_APP_ID = 'A2HF2P5C6X';
export const ALGOLIA_SEARCH_KEY = '45216ed5ac3f9e0a478d3c354d353d58';
export const ANIME_INDEX_FALLBACK = 'anime-staging';

export const PAGE_SIZE_OPTIONS = [24, 48, 72, 100];

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
  /** Works ride along in the same round trip when the query can carry them. */
  includeWorks: boolean;
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

export function buildSearchRequests(request: CatalogSearchRequest, indexes: AlgoliaIndexes): any[] {
  const requests: any[] = [
    {
      indexName: indexes.animeIndex,
      query: request.query,
      hitsPerPage: request.perPage,
      page: request.hitsPage,
      filters: request.genre ? `tags:"${request.genre}"` : undefined,
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

/** The genre browse strip: facet counts over the whole index, not one page. */
export function buildGenreFacetRequest(indexes: AlgoliaIndexes): any {
  return { indexName: indexes.animeIndex, query: '', hitsPerPage: 0, facets: ['tags'] };
}

export function parseGenreFacetResponse(response: any): GenreFacet[] {
  const first = response?.results?.[0] || response;
  return toGenreFacets(first?.facets?.tags);
}

/* ── The URL, including paging ───────────────────────────────────────────── */

/** Everything a /search URL asks for. Pages are zero-based here; `?page=` is one-based for people. */
export interface SearchPageParams extends SearchUrlState {
  hitsPage: number;
  worksPage: number;
  perPage: number;
}

function pageParam(params: URLSearchParams, name: string): number {
  const n = Number.parseInt(params.get(name) || '', 10);
  return Number.isFinite(n) && n >= 1 ? n - 1 : 0;
}

export function readSearchParams(search: string | URLSearchParams): SearchPageParams {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const perPageRaw = Number.parseInt(params.get('perPage') || '', 10);
  return {
    ...readSearchUrl(params),
    hitsPage: pageParam(params, 'page'),
    worksPage: pageParam(params, 'wpage'),
    perPage: PAGE_SIZE_OPTIONS.includes(perPageRaw) ? perPageRaw : PAGE_SIZE_OPTIONS[0],
  };
}

/**
 * A link to another page of the same search. Built on `writeSearchUrl` so the
 * query and genre are spelled exactly as the page itself writes them; a first
 * page or the default size writes nothing, keeping the plain URL plain.
 */
export function searchPageHref(
  current: SearchPageParams,
  patch: Partial<Pick<SearchPageParams, 'hitsPage' | 'worksPage' | 'perPage'>> = {}
): string {
  const next = { ...current, ...patch };
  const base = writeSearchUrl('', { query: next.query, genre: next.genre });
  const params = new URLSearchParams(base.replace(/^\?/, ''));
  if (next.hitsPage > 0) params.set('page', String(next.hitsPage + 1));
  if (next.worksPage > 0) params.set('wpage', String(next.worksPage + 1));
  if (next.perPage !== PAGE_SIZE_OPTIONS[0]) params.set('perPage', String(next.perPage));
  const qs = params.toString();
  return `/search${qs ? `?${qs}` : ''}`;
}

/** The request a URL's worth of parameters turns into. */
export function toCatalogRequest(params: SearchPageParams): CatalogSearchRequest {
  const query = params.query.trim();
  return {
    query,
    hitsPage: params.hitsPage,
    worksPage: params.worksPage,
    perPage: params.perPage,
    genre: params.genre,
    includeWorks: !!query && !params.genre,
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

export { isBrowseState };
