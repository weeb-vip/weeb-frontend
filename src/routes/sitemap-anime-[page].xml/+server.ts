import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSSRGraphQLClient } from '$lib/server/ssr-graphql';
import {
  ANIME_PER_SITEMAP,
  chunkCount,
  getAnimeEntries,
  renderUrlset,
  xmlResponse
} from '$lib/server/sitemap';

/** One chunk of show pages. Chunk numbers are 1-based, as listed in the index. */
export const GET: RequestHandler = async ({ params, locals }) => {
  const page = Number(params.page);
  if (!Number.isInteger(page) || page < 1) error(404, 'Not found');

  const client = createSSRGraphQLClient(locals.config.graphql_host, null);
  const anime = await getAnimeEntries(client);

  // 404 rather than an empty urlset: a chunk beyond the end is a stale index entry,
  // and Search Console should surface that instead of silently reporting zero URLs.
  if (page > chunkCount(anime.length)) error(404, 'Not found');

  const start = (page - 1) * ANIME_PER_SITEMAP;
  return xmlResponse(renderUrlset(anime.slice(start, start + ANIME_PER_SITEMAP)));
};
