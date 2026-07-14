import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { makeSSRFetcher, loggedOutAuth } from '$lib/server/ssr-graphql';
import { getSeasonalAnime } from '../../../services/api/graphql/queries';

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

export const load: PageServerLoad = async ({ params, locals, request }) => {
  const { season } = params;

  const validSeasonPattern = /^(WINTER|SPRING|SUMMER|FALL)_\d{4}$/;
  if (!season || !validSeasonPattern.test(season)) {
    redirect(302, '/season/' + getCurrentSeason());
  }

  const { auth, config } = locals;
  const cookieHeader = request.headers.get('cookie');

  let seasonalData: any = null;
  let ssrError: string | null = null;

  const fetcher = makeSSRFetcher(config.graphql_host, cookieHeader);

  try {
    seasonalData = await fetcher.fetchWithFallback(getSeasonalAnime, { season, limit: 500 }, 'seasonal data');
  } catch (error) {
    console.error('[SSR] Failed to load season page:', error);
    ssrError = 'Failed to load data';
  }

  const isTokenExpired = fetcher.wasTokenExpired();

  return {
    auth: isTokenExpired ? loggedOutAuth() : auth,
    season,
    displayName: getSeasonDisplayName(season),
    seasonalData,
    ssrError,
    isTokenExpired
  };
};
