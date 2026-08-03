import type { RequestHandler } from './$types';
import { resolveOgImage } from '$lib/server/og-image';
import { createSSRGraphQLClient } from '$lib/server/ssr-graphql';

/**
 * Share image for an anime: /og/<id>
 *
 * Redirects to whichever image actually exists (banner, then poster, then the site
 * default). Living behind one stable URL means `og:image` is always a live 200 and
 * the fallback logic sits in a single place, instead of every page guessing a CDN
 * path that may 404.
 *
 * Deliberately extensionless. hooks.server.ts treats any path matching
 * /\.(png|jpg|ico|webp|svg|css|js|json)$/ as a static asset and returns early
 * without setting locals.config — so a /og/<id>.jpg route would run without the
 * environment's cdn_url and silently point staging at the production CDN.
 *
 * Equally deliberately, the title is NOT a query parameter. robots.txt carries
 * `Disallow: /*?*`, so /og/<id>?t=<title> would be barred from the very crawlers
 * whose cards this exists to populate. It is resolved here instead, and only when
 * the banner is missing — most requests never make the call.
 */
export const GET: RequestHandler = async ({ params, url, locals, fetch }) => {
  const target = await resolveOgImage({
    id: params.id,
    cdnUrl: locals.config?.cdn_url,
    origin: url.origin,
    fetchImpl: fetch,
    getSource: async () => {
      const client = createSSRGraphQLClient(locals.config.graphql_host, null);
      const res: any = await client.request(
        `query OgImageSource($id: ID!) { anime(id: $id) { titleEn titleJp imageUrl } }`,
        { id: params.id }
      );
      if (!res?.anime) return null;
      return {
        title: res.anime.titleEn || res.anime.titleJp || null,
        imageUrl: res.anime.imageUrl || null
      };
    }
  });

  return new Response(null, {
    status: 302,
    headers: {
      location: target,
      // Crawlers refetch often; let the CDN absorb it. Short enough that a
      // newly synced banner shows up the same day.
      'cache-control': 'public, max-age=3600, s-maxage=86400'
    }
  });
};
