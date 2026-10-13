import type { RequestHandler } from './$types';
import { createSSRGraphQLClient } from '$lib/server/ssr-graphql';
import {
  chunkCount,
  worksChunkCount,
  getAnimeRecords,
  getWorksTotal,
  renderIndex,
  xmlResponse
} from '$lib/server/sitemap';

/**
 * Sitemap index. The catalogue is ~32,000 anime, past what belongs in a single file
 * once news pages are counted, so the show pages are split into chunks and listed here.
 *
 * Children are addressed on the requesting origin, so a sitemap fetched from staging
 * points at staging rather than sending crawlers to production.
 *
 * Submit this URL to Search Console; the children are discovered from it.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const client = createSSRGraphQLClient(locals.config.graphql_host, null);
  // Counted after dropping slugless and thin records, the same filter the chunks
  // apply, so the index never lists an anime chunk that would come back empty.
  const [anime, worksTotal] = await Promise.all([
    getAnimeRecords(client),
    // A works failure leaves the anime sitemaps standing rather than taking the
    // whole index down; the works chunks reappear on the next successful build.
    getWorksTotal(client).catch((e) => {
      console.error('[sitemap] works total failed:', e);
      return 0;
    })
  ]);
  const listedAnime = anime.filter(({ slug, thin }) => slug && !thin).length;
  const site = url.origin;

  const children = [
    { loc: `${site}/sitemap-pages.xml` },
    // Listed before the back catalogue. Ordering carries no documented weight with
    // Google, but it reflects what a human should look at first in Search Console.
    { loc: `${site}/sitemap-airing.xml` },
    ...Array.from({ length: chunkCount(listedAnime) }, (_, i) => ({
      loc: `${site}/sitemap-anime-${i + 1}.xml`
    })),
    ...Array.from({ length: worksChunkCount(worksTotal) }, (_, i) => ({
      loc: `${site}/sitemap-works-${i + 1}.xml`
    })),
    { loc: `${site}/sitemap-news.xml` }
  ];

  return xmlResponse(renderIndex(children));
};
