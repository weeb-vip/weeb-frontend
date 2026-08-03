import type { RequestHandler } from './$types';
import { createSSRGraphQLClient } from '$lib/server/ssr-graphql';
import { getNewsEntries, renderUrlset, xmlResponse } from '$lib/server/sitemap';

/**
 * News hub pages, for anime that actually have news.
 *
 * Note this lists /show/<id>/news, not individual stories — they have no URLs of
 * their own yet. Per-article routes are what would let Google rank individual
 * stories; until they exist this is the finest granularity available.
 */
export const GET: RequestHandler = async ({ locals }) => {
  const client = createSSRGraphQLClient(locals.config.graphql_host, null);
  return xmlResponse(renderUrlset(await getNewsEntries(client)));
};
