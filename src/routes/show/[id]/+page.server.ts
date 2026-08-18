import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAnimeSlugByID } from '../../../services/api/graphql/queries';
import { createSSRGraphQLClient, cookieHeaderFrom, isNotFoundError } from '$lib/server/ssr-graphql';

/**
 * /show/<id> is the old anime URL. It now redirects to /anime/<slug>.
 *
 * 301 rather than 302, and kept indefinitely rather than for a migration
 * window: roughly 32,000 of these are in Google's index and scattered across
 * external links, and a permanent redirect is what transfers their ranking to
 * the new URL. A temporary one asks Google to keep the old URL indexed, which
 * is the opposite of the point.
 *
 * Only the slug is fetched here. The redirect runs for every legacy URL a
 * crawler still holds, so it must not pull episodes, news and characters just
 * to read one string.
 */
export const load: PageServerLoad = async ({ params, locals, cookies }) => {
  const { id } = params;

  if (!id) {
    redirect(302, '/');
  }

  const { config } = locals;
  const client = createSSRGraphQLClient(config.graphql_host, cookieHeaderFrom(cookies));

  let anime: { id: string; slug?: string | null } | null = null;

  try {
    const res: any = await client.request(getAnimeSlugByID, { id });
    anime = res?.anime ?? null;
  } catch (err: any) {
    // A missing anime arrives as a thrown DOWNSTREAM_SERVICE_ERROR rather than a
    // null field. Anything else is a gateway problem, and answering 404 to that
    // would tell Google a real page is gone.
    if (isNotFoundError(err)) {
      error(404, 'Anime not found');
    }
    console.error('[SSR] Failed to resolve anime slug:', err);
    error(503, 'Unable to resolve this anime right now');
  }

  if (!anime) {
    error(404, 'Anime not found');
  }

  // Every anime in postgres has a slug, but MySQL trails it by however long CDC
  // takes, so a brand-new anime can legitimately arrive here without one yet.
  // Serving 404 for those would be wrong, and there is no slug to redirect to,
  // so ask the crawler to come back rather than recording a verdict.
  if (!anime.slug) {
    error(503, 'This anime does not have a URL yet');
  }

  redirect(301, `/anime/${anime.slug}`);
};
