import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { resolveOgImage } from '$lib/server/og-image';

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
 * Both candidates are keyed by the anime id, so this costs no data lookup at
 * all — it used to resolve the title over GraphQL to derive the poster slug.
 */
export const GET: RequestHandler = async ({ params, url, locals, fetch }) => {
  const target = await resolveOgImage({
    id: params.id,
    cdnUrl: locals.config?.cdn_url,
    origin: url.origin,
    fetchImpl: fetch,
    // Matched by the Cloudflare WAF Skip rule that lets our own origin probe
    // /weeb/*. Absent in local dev, where it is simply an ignored header.
    probeSecret: env.OG_PROBE_SECRET
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
