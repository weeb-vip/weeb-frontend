import type { RequestHandler } from './$types';
import { createSSRGraphQLClient } from '$lib/server/ssr-graphql';
import {
  SITE_URL,
  STATIC_PATHS,
  getSeasonEntries,
  renderUrlset,
  xmlResponse
} from '$lib/server/sitemap';

/** Static pages plus the season pages that actually have anime behind them. */
export const GET: RequestHandler = async ({ locals }) => {
  const client = createSSRGraphQLClient(locals.config.graphql_host, null);

  const statics = STATIC_PATHS.map((path) => ({
    loc: path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`
  }));

  let seasons: { loc: string }[] = [];
  try {
    seasons = await getSeasonEntries(client, new Date());
  } catch (e) {
    // A season lookup failure should not take out the whole sitemap — the static
    // pages are still worth serving.
    console.error('[sitemap] season discovery failed:', e);
  }

  return xmlResponse(renderUrlset([...statics, ...seasons]));
};
