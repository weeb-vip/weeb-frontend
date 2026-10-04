import type { PageServerLoad } from './$types';
import {
  buildGenreFacetRequest,
  buildSearchRequests,
  indexesFrom,
  isBrowseState,
  parseGenreFacetResponse,
  parseSearchResponse,
  readSearchParams,
  resolveAlgoliaFactory,
  toCatalogRequest,
  wantsWorks,
  ALGOLIA_APP_ID,
  ALGOLIA_SEARCH_KEY,
  type SearchPageSeed,
} from './search.logic';

/**
 * How long the first render may wait on Algolia. It answers in well under a
 * hundred milliseconds; past this the page ships without results and the
 * browser searches for itself, as it did before there was a loader at all.
 */
const ALGOLIA_TIMEOUT_MS = 2500;

type SearchClient = { search(args: { requests: any[] }): Promise<any> };
let clientPromise: Promise<SearchClient | null> | null = null;

/** One client per server process. The lite client is a thin fetch wrapper. */
function serverClient(): Promise<SearchClient | null> {
  if (!clientPromise) {
    clientPromise = import('algoliasearch/lite')
      .then((module: any) => {
        const factory = resolveAlgoliaFactory(module);
        return factory ? (factory(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY) as SearchClient) : null;
      })
      .catch((error) => {
        console.error('[search] Algolia client unavailable on the server:', error);
        return null;
      });
  }
  return clientPromise;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Algolia did not answer within ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

/**
 * The first render of /search, built on the server: the genre strip and, for
 * a URL that names a search, the page of results it asks for. One Algolia
 * round trip carries both. Any failure degrades to the client search rather
 * than an error page -- a search box must never be the thing that is down.
 */
export const load: PageServerLoad = async ({ url, locals }) => {
  const params = readSearchParams(url.searchParams);
  const indexes = indexesFrom(locals.config);
  const browse = isBrowseState(params);
  const request = toCatalogRequest(params);
  const seed: SearchPageSeed = { key: url.search, params, results: null, genres: null };

  try {
    const client = await serverClient();
    if (client) {
      const requests = [buildGenreFacetRequest(indexes)];
      if (!browse) requests.push(...buildSearchRequests(request, indexes));
      const response = await withTimeout(client.search({ requests }), ALGOLIA_TIMEOUT_MS);
      const results: any[] = response?.results ?? [];
      seed.genres = parseGenreFacetResponse({ results: [results[0]] });
      if (!browse) {
        seed.results = parseSearchResponse({ results: results.slice(1) }, wantsWorks(request, indexes));
      }
    }
  } catch (error) {
    console.error('[search] server search failed; the browser will search instead:', error);
  }

  return { search: seed };
};
