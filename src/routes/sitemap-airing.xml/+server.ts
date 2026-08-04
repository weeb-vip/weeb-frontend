import type { RequestHandler } from './$types';
import { createSSRGraphQLClient, getCurrentSeason } from '$lib/server/ssr-graphql';
import { animeEntries, getAiringRecords, renderUrlset, xmlResponse } from '$lib/server/sitemap';

/**
 * The anime that matter right now: airing today, plus the current season.
 *
 * Separate from the bulk chunks so Search Console reports their indexing coverage on
 * their own, rather than averaged into 32,000 back-catalogue URLs. Deliberately not
 * expressed with <priority> or <changefreq> — Google ignores both.
 *
 * These URLs also appear in the sitemap-anime-N chunks. That overlap is intentional:
 * the spec allows a URL in more than one sitemap, Google deduplicates, and per-sitemap
 * coverage is still reported for each file — so excluding them from the chunks would
 * add bookkeeping without improving the diagnostic.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const client = createSSRGraphQLClient(locals.config.graphql_host, null);
  const records = await getAiringRecords(client, getCurrentSeason());
  return xmlResponse(renderUrlset(animeEntries(records, url.origin)));
};
