import type { Cookies } from '@sveltejs/kit';
import { makeSSRFetcher, loggedOutAuth, publicAuth, cookieHeaderFrom } from './ssr-graphql';
import { getWorksByType, isWorkSort } from '../../services/api/graphql/works';

/**
 * The shared load for the work browse pages.
 *
 * /manga and /light-novels differ by one string and their copy; everything
 * else -- paging, sort validation, the fetch, the error shape -- is identical.
 * Two copies of this would drift the way workSubtitle's three copies did.
 */

export const PER_PAGE = 24;

export interface WorksBrowseLoad {
  type: string;
  url: URL;
  locals: App.Locals;
  cookies: Cookies;
}

export async function loadWorksBrowse({ type, url, locals, cookies }: WorksBrowseLoad) {
  const { auth, config } = locals;

  // Page is 1-based in the URL and 0-based on the wire. Readers see ?page=1
  // for the first page, which is what a pager that says "1 of 2,219" implies;
  // the API counts from zero like AnimeSearchInput does.
  const requestedPage = Number(url.searchParams.get('page') ?? '1');
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

  const requestedSort = url.searchParams.get('sort');
  const sort = isWorkSort(requestedSort) ? requestedSort : 'POPULARITY';

  const fetcher = makeSSRFetcher(config.graphql_host, cookieHeaderFrom(cookies));

  let result: any = null;
  let ssrError: string | null = null;

  try {
    result = await fetcher.fetchWithFallback(
      getWorksByType,
      { input: { type, page: page - 1, perPage: PER_PAGE, sortBy: sort } },
      `${type} browse page ${page}`,
    );
  } catch (error) {
    console.error(`[SSR] Failed to fetch works for ${type}:`, error);
    ssrError = 'Failed to load';
  }

  const pageData = result?.works ?? null;
  const total: number = pageData?.total ?? 0;

  return {
    auth: fetcher.wasTokenExpired() ? loggedOutAuth() : publicAuth(auth),
    works: pageData?.works ?? [],
    total,
    page,
    perPage: PER_PAGE,
    totalPages: total > 0 ? Math.ceil(total / PER_PAGE) : 0,
    sort,
    ssrError,
  };
}
