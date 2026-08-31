import type { PageServerLoad } from './$types';
import { makeSSRFetcher, loggedOutAuth, publicAuth, cookieHeaderFrom } from '$lib/server/ssr-graphql';
import {
  queryUserAnimes,
  queryUserWorks,
  queryUserAnimeStatusCounts,
  queryUserWorkStatusCounts
} from '../../../services/api/graphql/queries';
import { Status, WorkStatus } from '../../../gql/graphql';

// The list page renders whatever medium, status and page the URL names, so the
// server has to resolve those before it fetches -- otherwise SSR would load one
// shelf and the client hydrate into another, refetching immediately and undoing
// the point of rendering it on the server at all.
const SSR_PER_PAGE = 24;

/** The status the active medium opens on when the URL names none. */
function defaultStatus(medium: 'anime' | 'manga'): string {
  return medium === 'manga' ? WorkStatus.Reading : Status.Plantowatch;
}

/** A URL status param, but only when it belongs to the medium being shown. */
function resolveStatus(medium: 'anime' | 'manga', raw: string | null): string {
  if (!raw) return defaultStatus(medium);
  const values: string[] =
    medium === 'manga' ? Object.values(WorkStatus) : Object.values(Status);
  return values.includes(raw) ? raw : defaultStatus(medium);
}

export const load: PageServerLoad = async ({ locals, cookies, url }) => {
  const { auth, config } = locals;
  const cookieHeader = cookieHeaderFrom(cookies);
  const fetcher = makeSSRFetcher(config.graphql_host, cookieHeader);

  const medium: 'anime' | 'manga' = url.searchParams.get('medium') === 'manga' ? 'manga' : 'anime';
  const status = resolveStatus(medium, url.searchParams.get('status'));
  const pageParam = parseInt(url.searchParams.get('page') ?? '', 10);
  const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  // Signed-out visitors are bounced to login by the layout guard, so there is
  // nothing here worth the round trips; the client still renders the shell.
  if (!auth.isLoggedIn) {
    return {
      ssr: { medium, status, page: page - 1, perPage: SSR_PER_PAGE, loggedIn: false }
    };
  }

  // Counts for both media, so the Anime | Manga switch is instant either way,
  // and the active medium's list for the resolved status and page.
  const [animeCounts, workCounts, list] = await Promise.all([
    fetcher.fetchWithFallback(queryUserAnimeStatusCounts, {}, 'anime status counts'),
    fetcher.fetchWithFallback(queryUserWorkStatusCounts, {}, 'work status counts'),
    medium === 'manga'
      ? fetcher.fetchWithFallback(
          queryUserWorks,
          { input: { status, limit: SSR_PER_PAGE, page } },
          'reading list'
        )
      : fetcher.fetchWithFallback(
          queryUserAnimes,
          { input: { status, limit: SSR_PER_PAGE, page } },
          'watchlist'
        )
  ]);

  const isTokenExpired = fetcher.wasTokenExpired();

  return {
    auth: isTokenExpired ? loggedOutAuth() : publicAuth(auth),
    isTokenExpired,
    ssr: {
      medium,
      status,
      page: page - 1, // components page from zero
      perPage: SSR_PER_PAGE,
      loggedIn: !isTokenExpired,
      // Shaped to each query's own return, so a component can hand these
      // straight to initialData.
      animeCounts: (animeCounts as any)?.UserAnimeStatusCounts ?? null,
      workCounts: (workCounts as any)?.UserWorkStatusCounts ?? null,
      animeList: medium === 'anime' ? (list as any)?.UserAnimes ?? null : null,
      workList: medium === 'manga' ? (list as any)?.UserWorks ?? null : null
    }
  };
};
