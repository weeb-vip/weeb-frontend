import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSSRGraphQLClient } from '$lib/server/ssr-graphql';
import {
  getWorkChunk,
  getWorksTotal,
  renderUrlset,
  workEntries,
  worksChunkCount,
  xmlResponse
} from '$lib/server/sitemap';

/**
 * One slice of manga and light novel pages; see getWorkChunk for why works are
 * sliced by API page rather than listed whole like the anime. Same 1-based
 * numbering and the same 404 for a chunk past the end as the anime chunks.
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
  const page = Number(params.page);
  if (!Number.isInteger(page) || page < 1) error(404, 'Not found');

  const client = createSSRGraphQLClient(locals.config.graphql_host, null);
  if (page > worksChunkCount(await getWorksTotal(client))) error(404, 'Not found');

  return xmlResponse(renderUrlset(workEntries(await getWorkChunk(client, page), url.origin)));
};
