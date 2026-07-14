import type { PageServerLoad } from './$types';
import { startOfMonth } from 'date-fns';
import { makeSSRFetcher, loggedOutAuth, publicAuth, cookieHeaderFrom } from '$lib/server/ssr-graphql';
import { getCurrentlyAiringWithDatesAndEpisodes } from '../../../services/api/graphql/queries';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  const { auth, config } = locals;
  const cookieHeader = cookieHeaderFrom(cookies);

  let calendarData: any = null;
  let ssrError: string | null = null;

  const fetcher = makeSSRFetcher(config.graphql_host, cookieHeader);

  try {
    const calendarStart = startOfMonth(new Date());

    calendarData = await fetcher.fetchWithFallback(getCurrentlyAiringWithDatesAndEpisodes, {
      input: { startDate: calendarStart, daysInFuture: 32 },
      limit: 300
    }, 'calendar data');
  } catch (error) {
    console.error('[SSR] Failed to create GraphQL client for calendar page:', error);
    ssrError = 'Failed to load calendar data';
  }

  const isTokenExpired = fetcher.wasTokenExpired();

  return {
    auth: isTokenExpired ? loggedOutAuth() : publicAuth(auth),
    ssrData: calendarData,
    ssrError,
    isTokenExpired
  };
};
