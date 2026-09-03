import type { Cookies } from '@sveltejs/kit';
import { makeSSRFetcher, loggedOutAuth, publicAuth, cookieHeaderFrom } from './ssr-graphql';
import {
  getWorksOverview,
  getWorksByType,
  isWorkSort,
  WORK_SHELVES,
} from '../../services/api/graphql/works';

/**
 * The shared load for the work browse pages.
 *
 * /manga and /light-novels differ by which kinds they scope to and their
 * copy; everything else -- the two view modes, paging, sort validation, the
 * fetch -- is identical. Two copies of this would drift the way workSubtitle's three
 * copies did.
 *
 * Two views from one route rather than two:
 *
 *   /manga             three shelves, one per sort
 *   /manga?sort=SCORE  that shelf in full, paged
 *
 * The shelves answer "show me something"; the paged view answers "show me all
 * of it". A reader who wants the second arrives through the first, so it is
 * the same page deepened rather than a separate destination to find.
 */

/** Enough to fill the widest shelf; the grid slices to the viewport. */
export const SHELF_SIZE = 20;
export const PER_PAGE = 24;

export interface WorksBrowseLoad {
  /** Kinds to include; omit to mean every kind. */
  types?: readonly string[];
  /** Kinds to leave out, for the shelf that means "everything else". */
  excludeTypes?: readonly string[];
  url: URL;
  locals: App.Locals;
  cookies: Cookies;
}

export async function loadWorksBrowse({ types, excludeTypes, url, locals, cookies }: WorksBrowseLoad) {
  const { auth, config } = locals;
  const fetcher = makeSSRFetcher(config.graphql_host, cookieHeaderFrom(cookies));

  const requestedSort = url.searchParams.get('sort');
  const sort = isWorkSort(requestedSort) ? requestedSort : null;

  // Page is 1-based in the URL and 0-based on the wire. Readers see ?page=1
  // for the first page, which is what a pager reading "1 of 2,219" implies;
  // the API counts from zero like AnimeSearchInput does.
  const requestedPage = Number(url.searchParams.get('page') ?? '1');
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

  let ssrError: string | null = null;
  const scope = {
    ...(types ? { types: [...types] } : {}),
    ...(excludeTypes ? { excludeTypes: [...excludeTypes] } : {}),
  };
  const label = types ? types.join('+') : `not ${excludeTypes?.join('+')}`;
  const base = { auth: publicAuth(auth), sort };

  if (sort) {
    let result: any = null;
    try {
      result = await fetcher.fetchWithFallback(
        getWorksByType,
        { input: { ...scope, page: page - 1, perPage: PER_PAGE, sortBy: sort } },
        `${label} ${sort} page ${page}`,
      );
    } catch (error) {
      console.error(`[SSR] Failed to fetch works for ${label}/${sort}:`, error);
      ssrError = 'Failed to load';
    }

    // A null result is a failure, not an empty shelf. fetchWithFallback
    // swallows the error and returns null rather than throwing, so without
    // this check a rejected query renders as "nothing here" -- which is a lie
    // the reader cannot tell from an actually empty catalogue, and which hid a
    // schema mismatch behind a plausible-looking page.
    if (!ssrError && !result?.works) {
      ssrError = 'Failed to load';
    }

    const total: number = result?.works?.total ?? 0;

    return {
      ...base,
      auth: fetcher.wasTokenExpired() ? loggedOutAuth() : publicAuth(auth),
      ssrError,
      shelves: null,
      works: result?.works?.works ?? [],
      total,
      page,
      perPage: PER_PAGE,
      totalPages: total > 0 ? Math.ceil(total / PER_PAGE) : 0,
    };
  }

  let result: any = null;
  try {
    const input = (sortBy: string) => ({ ...scope, page: 0, perPage: SHELF_SIZE, sortBy });
    result = await fetcher.fetchWithFallback(
      getWorksOverview,
      {
        popular: input('POPULARITY'),
        rated: input('SCORE'),
        newest: input('NEWEST'),
      },
      `${label} shelves`,
    );
  } catch (error) {
    console.error(`[SSR] Failed to fetch shelves for ${label}:`, error);
    ssrError = 'Failed to load';
  }

  // As above: no result means the request failed, not that the shelves are
  // empty. Checked against the first alias rather than the wrapper, because a
  // partial response with one alias missing is also a failure.
  if (!ssrError && !result?.popular) {
    ssrError = 'Failed to load';
  }

  // Each shelf carries its own total, and they are all the same number -- the
  // count for the scope. Taken from the first that answered rather than a
  // fourth query for it.
  const shelves = WORK_SHELVES.map((shelf) => ({
    sort: shelf.sort,
    label: shelf.label,
    works: result?.[shelf.key]?.works ?? [],
  }));

  return {
    ...base,
    auth: fetcher.wasTokenExpired() ? loggedOutAuth() : publicAuth(auth),
    ssrError,
    shelves,
    works: [],
    total: result?.popular?.total ?? 0,
    page: 1,
    perPage: SHELF_SIZE,
    totalPages: 0,
  };
}
