import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { makeSSRFetcher, loggedOutAuth, publicAuth, cookieHeaderFrom } from '$lib/server/ssr-graphql';
import { getSeasonalAnime } from '$lib/services/api/graphql/queries';

function getCurrentSeason(): string {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month >= 3 && month <= 5) return `SPRING_${year}`;
  if (month >= 6 && month <= 8) return `SUMMER_${year}`;
  if (month >= 9 && month <= 11) return `FALL_${year}`;
  const winterYear = month === 11 ? year + 1 : year;
  return `WINTER_${winterYear}`;
}

function getSeasonDisplayName(s: string): string {
  const [name, year] = s.split('_');
  return `${name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()} ${year}`;
}

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
  const { season } = params;

  const validSeasonPattern = /^(WINTER|SPRING|SUMMER|FALL)_\d{4}$/;
  if (!season || !validSeasonPattern.test(season)) {
    redirect(302, '/season/' + getCurrentSeason());
  }

  const { auth, config } = locals;
  const cookieHeader = cookieHeaderFrom(cookies);

  let seasonalData: any = null;
  let ssrError: string | null = null;

  const fetcher = makeSSRFetcher(config.graphql_host, cookieHeader);

  try {
    seasonalData = await fetcher.fetchWithFallback(getSeasonalAnime, { season, limit: 500 }, 'seasonal data');
  } catch (error) {
    console.error('[SSR] Failed to load season page:', error);
    ssrError = 'Failed to load data';
  }

  // A null answer is a failure, not an empty season. fetchWithFallback swallows
  // every failure and RETURNS null rather than throwing, so the try/catch above
  // almost never fires and an outage would reach the page as "no anime this
  // season" instead of as a recoverable error the client can retry. A season
  // that really is empty still arrives as a response object. Same rule as
  // loadWorksBrowse.
  if (!ssrError && !seasonalData) {
    ssrError = 'Failed to load data';
  }

  const isTokenExpired = fetcher.wasTokenExpired();

  return {
    auth: isTokenExpired ? loggedOutAuth() : publicAuth(auth),
    season,
    displayName: getSeasonDisplayName(season),
    seasonalData,
    ssrError,
    isTokenExpired
  };
};
