import type { RequestHandler } from './$types';
import { createSSRGraphQLClient } from '$lib/server/ssr-graphql';
import { STATIC_PATHS, getSeasonEntries, renderUrlset, xmlResponse } from '$lib/server/sitemap';

/** Static pages plus the season pages that actually have anime behind them. */
export const GET: RequestHandler = async ({ locals, url }) => {
  const client = createSSRGraphQLClient(locals.config.graphql_host, null);
  const site = url.origin;

  const statics = STATIC_PATHS.map((path) => ({
    loc: path === '/' ? `${site}/` : `${site}${path}`
  }));

  let seasons: { loc: string }[] = [];
  try {
    seasons = await getSeasonEntries(client, new Date(), site);
  } catch (e) {
    // A season lookup failure should not take out the whole sitemap — the static
    // pages are still worth serving.
    console.error('[sitemap] season discovery failed:', e);
  }

  return xmlResponse(renderUrlset([...statics, ...seasons]));
};
