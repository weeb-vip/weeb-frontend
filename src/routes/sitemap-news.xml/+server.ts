import type { RequestHandler } from './$types';
import { createSSRGraphQLClient } from '$lib/server/ssr-graphql';
import {
  getAnimeRecords,
  getNewsRecords,
  newsEntries,
  renderUrlset,
  xmlResponse
} from '$lib/server/sitemap';

/**
 * News hub pages, for anime that actually have news.
 *
 * Note this lists /anime/<slug>/news, not individual stories — they have no URLs of
 * their own yet. Per-article routes are what would let Google rank individual
 * stories; until they exist this is the finest granularity available.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const client = createSSRGraphQLClient(locals.config.graphql_host, null);
  // latestNews only reports animeId, so the slugs come from the anime records,
  // which are cached and already fetched for the other sitemaps.
  const anime = await getAnimeRecords(client);
  const slugById = new Map(
    anime.flatMap(({ id, slug }) => (slug ? [[id, slug] as [string, string]] : []))
  );
  const records = await getNewsRecords(client, slugById);
  return xmlResponse(renderUrlset(newsEntries(records, url.origin)));
};
