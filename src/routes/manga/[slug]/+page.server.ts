import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getWorkBySlug } from '../../../services/api/graphql/queries';
import { createSSRGraphQLClient, cookieHeaderFrom, isNotFoundError } from '$lib/server/ssr-graphql';
import { metaDescription } from '$lib/meta';

/**
 * The source work behind /manga/<slug> -- manga, light novel, novel, manhwa.
 *
 * Slug only, unlike /anime/[slug] which also accepts a uuid. That route needs
 * the id form because an anime exists before CDC has carried its slug across,
 * and without it a freshly added show has no reachable page. A work is
 * different: nothing links to a work by id, and its slug is assigned by a
 * trigger in the same insert that creates the row, so there is no window where
 * one exists without the other.
 */
export const load: PageServerLoad = async ({ params, locals, cookies }) => {
  const { slug } = params;
  const { config } = locals;

  let work: any = null;
  let loadError: string | null = null;

  try {
    const client = createSSRGraphQLClient(config.graphql_host, cookieHeaderFrom(cookies));
    const result: any = await client.request(getWorkBySlug, { slug });
    work = result?.workBySlug ?? null;
  } catch (err: any) {
    if (isNotFoundError(err)) {
      work = null;
    } else {
      console.error('[SSR] Failed to fetch work:', err);
      loadError = err?.message || 'Failed to fetch work';
    }
  }

  // A slug nothing claims is a 404, not an empty page. Distinct from a work
  // that exists and simply has no adaptations, which renders normally.
  if (!work && !loadError) {
    error(404, 'Not found');
  }

  const title = work?.titleEn || work?.titleJp || 'Manga';

  return {
    slug,
    workTitle: title,
    workDescription: metaDescription(work?.synopsis) || `${title} — details and anime adaptations`,
    // MyAnimeList's own URL, used only for the social card. The page itself
    // renders the CDN copy; a crawler cannot follow our fallback chain, so the
    // card points at the one URL that is certainly already fetchable.
    workImage: work?.imageUrl || '/assets/og-image.jpg',
    ssrWork: work,
    ssrError: loadError
  };
};
