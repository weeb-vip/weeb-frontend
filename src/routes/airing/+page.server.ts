import type { PageServerLoad } from './$types';
import { makeSSRFetcher, loggedOutAuth, publicAuth, cookieHeaderFrom } from '$lib/server/ssr-graphql';
import { getCurrentlyAiringWithDatesAndEpisodes } from '../../services/api/graphql/queries';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  const { auth, config } = locals;
  const cookieHeader = cookieHeaderFrom(cookies);

  let currentlyAiringData: any = null;
  let ssrError: string | null = null;

  const fetcher = makeSSRFetcher(config.graphql_host, cookieHeader);

  try {
    // Fetch from start of current month to end of next month — this gives
    // both schedule view (next 7 days) and calendar view their data
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    currentlyAiringData = await fetcher.fetchWithFallback(getCurrentlyAiringWithDatesAndEpisodes, {
      input: { startDate: defaultStartDate, endDate: defaultEndDate },
      limit: 100
    }, 'currently airing data');
  } catch (error) {
    console.error('[SSR] Failed to create GraphQL client for airing page:', error);
    ssrError = 'Failed to load data';
  }

  const isTokenExpired = fetcher.wasTokenExpired();

  return {
    auth: isTokenExpired ? loggedOutAuth() : publicAuth(auth),
    ssrData: currentlyAiringData,
    ssrError,
    isTokenExpired
  };
};
