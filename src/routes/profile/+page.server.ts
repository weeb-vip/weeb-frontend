import type { PageServerLoad } from './$types';
import { makeSSRFetcher, loggedOutAuth, publicAuth, cookieHeaderFrom } from '$lib/server/ssr-graphql';
import {
  queryUserDetails,
  queryUserAnimes,
  queryUserAnimeCount,
  getCurrentlyAiringWithDatesAndEpisodes
} from '../../services/api/graphql/queries';
import { Status } from '../../gql/graphql';

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
  const watchlist = auth.isLoggedIn
    ? Promise.all([
        fetcher.fetchWithFallback(queryUserDetails, {}, 'user details'),
        fetcher.fetchWithFallback(
          queryUserAnimes,
          { input: { status: Status.Watching, limit: 1000, page: 1 } },
          'watching list'
        ),
        fetcher.fetchWithFallback(
          queryUserAnimes,
          { input: { status: Status.Plantowatch, limit: 1000, page: 1 } },
          'plan-to-watch list'
        ),
        // Counts only. These three are rendered as integers and nothing reads
        // the rows behind them; asking for the list would pull every episode of
        // every entry to display three numbers.
        fetcher.fetchWithFallback(
          queryUserAnimeCount,
          { input: { status: Status.Completed, limit: 1, page: 1 } },
          'completed count'
        ),
        fetcher.fetchWithFallback(
          queryUserAnimeCount,
          { input: { status: Status.Dropped, limit: 1, page: 1 } },
          'dropped count'
        ),
        fetcher.fetchWithFallback(
          queryUserAnimeCount,
          { input: { status: Status.Onhold, limit: 1, page: 1 } },
          'on-hold count'
        )
      ])
    : Promise.resolve([null, null, null, null, null, null]);

  const airing = fetcher.fetchWithFallback(
    getCurrentlyAiringWithDatesAndEpisodes,
    { input: { startDate, endDate }, limit: 25 },
    'currently airing'
  );

  const [[user, watching, planToWatch, completed, dropped, onHold], currentlyAiring] =
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
      planToWatch: (planToWatch as any)?.UserAnimes ?? null,
      completed: (completed as any)?.UserAnimes ?? null,
      dropped: (dropped as any)?.UserAnimes ?? null,
      onHold: (onHold as any)?.UserAnimes ?? null,
      currentlyAiring: currentlyAiring ?? null,
      // The client rebuilds the same window; passing the bounds keeps its query
      // key identical to the one these results belong to.
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    }
  };
};
