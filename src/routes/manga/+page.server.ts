import type { PageServerLoad } from './$types';
import { loadWorksBrowse } from '$lib/server/works-browse';
import { NOVEL_TYPES } from '../../services/api/graphql/works';

/**
 * /manga -- the comics shelf.
 *
 * Everything that is not a novel, rather than `type = MANGA`. A reader
 * browsing comics does not distinguish a manga from a manhwa, a one-shot or a
 * doujinshi, and defining the shelf by exclusion means a kind MyAnimeList
 * invents next lands here instead of in no shelf at all.
 *
 * Sits alongside /manga/[slug], the detail page for the whole work family.
 */
export const load: PageServerLoad = async ({ url, locals, cookies }) =>
  loadWorksBrowse({ excludeTypes: NOVEL_TYPES, url, locals, cookies });
