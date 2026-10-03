import type { PageServerLoad } from './$types';
import { makeSSRFetcher, publicAuth, cookieHeaderFrom } from '$lib/server/ssr-graphql';
import { queryFeed } from '$lib/services/api/graphql/queries';
import { FEED_PAGE_SIZE } from '$lib/components/feed/activity';

// The feed is the viewer's own, so a signed-out visit has nothing to prefetch:
// the page explains itself and offers to sign in. Signed in, the first page
// rides the HTML so the grid is there on arrival rather than a beat later.
export const load: PageServerLoad = async ({ locals, cookies }) => {
  const { auth, config } = locals;
  const cookieHeader = cookieHeaderFrom(cookies);
  const fetcher = makeSSRFetcher(config.graphql_host, cookieHeader);

  const feed = auth.isLoggedIn
    ? await fetcher.fetchWithFallback(queryFeed, { page: 1, limit: FEED_PAGE_SIZE }, 'feed')
    : null;

  return {
    auth: publicAuth(auth),
    ssr: { feed: (feed as any)?.feed ?? null },
  };
};
