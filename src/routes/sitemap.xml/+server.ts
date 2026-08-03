import type { RequestHandler } from './$types';
import { createSSRGraphQLClient } from '$lib/server/ssr-graphql';
import {
  SITE_URL,
  chunkCount,
  getAnimeEntries,
  renderIndex,
  xmlResponse
} from '$lib/server/sitemap';

/**
 * Sitemap index. The catalogue is ~32,000 anime, past what belongs in a single file
 * once news pages are counted, so the show pages are split into chunks and listed here.
 *
 * Submit this URL to Search Console; the children are discovered from it.
 */
export const GET: RequestHandler = async ({ locals }) => {
  const client = createSSRGraphQLClient(locals.config.graphql_host, null);
  const anime = await getAnimeEntries(client);

  const children = [
    { loc: `${SITE_URL}/sitemap-pages.xml` },
    ...Array.from({ length: chunkCount(anime.length) }, (_, i) => ({
      loc: `${SITE_URL}/sitemap-anime-${i + 1}.xml`
    })),
    { loc: `${SITE_URL}/sitemap-news.xml` }
  ];

  return xmlResponse(renderIndex(children));
};
