import type { PageServerLoad } from './$types';
import { makeSSRFetcher, loggedOutAuth, getCurrentSeason } from '$lib/server/ssr-graphql';
import {
  getHomePageData,
  getCurrentlyAiringWithDates,
  getSeasonalAnime
} from '../services/api/graphql/queries';

export const load: PageServerLoad = async ({ locals, request }) => {
  const { auth, config } = locals;
  const cookieHeader = request.headers.get('cookie');
  const currentSeason = getCurrentSeason();

  let homeData: any = null;
  let currentlyAiringData: any = null;
  let seasonalData: any = null;
  let ssrError: string | null = null;

  const fetcher = makeSSRFetcher(config.graphql_host, cookieHeader);

  try {
    const defaultStartDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

    const [homeResult, currentlyAiringResult, seasonalResult] = await Promise.allSettled([
      fetcher.fetchWithFallback(getHomePageData, { limit: 20 }, 'home data'),
      fetcher.fetchWithFallback(getCurrentlyAiringWithDates, {
        input: { startDate: defaultStartDate, endDate: null, daysInFuture: 7 },
        limit: 10
      }, 'currently airing data'),
      fetcher.fetchWithFallback(getSeasonalAnime, { season: currentSeason, limit: 14 }, 'seasonal data')
    ]);

    homeData = homeResult.status === 'fulfilled' ? homeResult.value : null;
    currentlyAiringData = currentlyAiringResult.status === 'fulfilled' ? currentlyAiringResult.value : null;
    seasonalData = seasonalResult.status === 'fulfilled' ? seasonalResult.value : null;
  } catch (error) {
    console.error('[SSR] Failed to create GraphQL client:', error);
    ssrError = 'Failed to load data';
  }

  const isTokenExpired = fetcher.wasTokenExpired();
  const effectiveAuth = isTokenExpired ? loggedOutAuth() : auth;

  // First banner image for preloading
  let bannerImageUrl: string | null = null;
  const firstAnime = currentlyAiringData?.getAiringAnimeAll?.[0];
  if (firstAnime?.id) {
    bannerImageUrl = `https://cdn.weeb.vip/weeb/banners/${encodeURIComponent(firstAnime.id)}`;
  }

  return {
    auth: effectiveAuth,
    homeData,
    currentlyAiringData,
    seasonalData,
    currentSeason,
    ssrError,
    isTokenExpired,
    bannerImageUrl
  };
};
