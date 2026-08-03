import type { RequestHandler } from './$types';
import { resolveOgImage } from '$lib/server/og-image';

/**
 * Share image for an anime: /og/<id>?t=<title>
 *
 * Deliberately extensionless. hooks.server.ts treats any path matching
 * /\.(png|jpg|ico|webp|svg|css|js|json)$/ as a static asset and returns early
 * without setting locals.config — so a /og/<id>.jpg route would run without the
 * environment's cdn_url and silently point staging at the production CDN.
 *
 * Redirects to whichever image actually exists (banner, then poster, then the site
 * default). Existing behind one stable URL means `og:image` is always a live 200 and
 * the fallback logic lives in a single place, instead of every page guessing a CDN
 * path that may 404.
 *
 * The title comes in as a query parameter rather than being looked up here: the page
 * already has it, and a GraphQL round trip per crawler hit would be pure waste.
 */
export const GET: RequestHandler = async ({ params, url, locals, fetch }) => {
  const target = await resolveOgImage({
    id: params.id,
    title: url.searchParams.get('t'),
    cdnUrl: locals.config?.cdn_url,
    origin: url.origin,
    fetchImpl: fetch
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
