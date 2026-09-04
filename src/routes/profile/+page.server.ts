import type { PageServerLoad } from './$types';
import { makeSSRFetcher, loggedOutAuth, publicAuth, cookieHeaderFrom } from '$lib/server/ssr-graphql';
import {
  queryUserDetails,
  queryUserAnimes,
  queryUserAnimeStatusCounts,
  queryUserWorkStatusCounts,
  queryUserWorks,
  getCurrentlyAiringWithDatesAndEpisodes
} from '../../services/api/graphql/queries';
import { Status, WorkStatus } from '../../gql/graphql';

/** Mirrors the window ProfilePage asks for, so the client reuses this rather
 *  than fetching its own. */
const WEEK = 7 * 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async ({ locals, cookies }) => {
  const { auth, config } = locals;
  const cookieHeader = cookieHeaderFrom(cookies);
  const fetcher = makeSSRFetcher(config.graphql_host, cookieHeader);

  const startDate = new Date(Date.now() - WEEK);
  const endDate = new Date(Date.now() + WEEK);

  // Every watchlist query needs the signed-in user, so a signed-out visit has
  // nothing to prefetch and should not spend seven requests finding that out.
  // The airing window is public, so it is still worth fetching.
  // Two count queries and two short lists, where this used to be three count
  // queries and three lists of up to a thousand entries each.
  //
  // queryUserAnimes selects every episode of every entry, synopses included,
  // so `limit: 1000` on the watching and plan-to-watch lists pulled tens of
  // thousands of episode rows into this response. The counts had already been
  // cut down to `total` alone for exactly that reason; the lists had not.
  //
  // What the rows were for:
  //   - a Set of ids, to pick out which currently-airing shows are on the list
  //   - the entries behind those shows
  //   - `.total`, for the stat row
  //
  // The totals now come from the status-count queries the list page uses, which
  // return every status in one request. The airing cross-reference no longer
  // needs a watchlist at all: currentlyAiring already carries `userAnime` per
  // show, which is how the homepage builds its own "airing from your list" with
  // no extra query. That leaves only the rows actually rendered -- six watching
  // cards and twelve reading ones.
  const watchlist = auth.isLoggedIn
    ? Promise.all([
        fetcher.fetchWithFallback(queryUserDetails, {}, 'user details'),
        // Six, because the dashboard renders six. These are the only entries
        // whose episodes are read, for the next-episode line on each card.
        fetcher.fetchWithFallback(
          queryUserAnimes,
          { input: { status: Status.Watching, limit: 6, page: 1 } },
          'watching list'
        ),
        // Twelve, matching the Currently Reading row.
        fetcher.fetchWithFallback(
          queryUserWorks,
          { input: { status: WorkStatus.Reading, limit: 12, page: 1 } },
          'reading list'
        ),
        fetcher.fetchWithFallback(queryUserAnimeStatusCounts, {}, 'anime status counts'),
        fetcher.fetchWithFallback(queryUserWorkStatusCounts, {}, 'work status counts')
      ])
    : Promise.resolve([null, null, null, null, null]);

  const airing = fetcher.fetchWithFallback(
    getCurrentlyAiringWithDatesAndEpisodes,
    { input: { startDate, endDate }, limit: 25 },
    'currently airing'
  );

  const [[user, watching, reading, animeCounts, workCounts], currentlyAiring] =
    await Promise.all([watchlist, airing]);

  const isTokenExpired = fetcher.wasTokenExpired();

  return {
    auth: isTokenExpired ? loggedOutAuth() : publicAuth(auth),
    isTokenExpired,
    // Shaped to match what each query's own queryFn returns, so these can be
    // handed straight to initialData. The list queries unwrap to UserAnimes and
    // the user query to UserDetails; the airing query keeps its whole response.
    ssr: {
      user: (user as any)?.UserDetails ?? null,
      watching: (watching as any)?.UserAnimes ?? null,
      reading: (reading as any)?.UserWorks ?? null,
      animeCounts: (animeCounts as any)?.UserAnimeStatusCounts ?? null,
      workCounts: (workCounts as any)?.UserWorkStatusCounts ?? null,
      currentlyAiring: currentlyAiring ?? null,
      // The client rebuilds the same window; passing the bounds keeps its query
      // key identical to the one these results belong to.
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    }
  };
};
