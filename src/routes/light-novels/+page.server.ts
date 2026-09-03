import type { PageServerLoad } from './$types';
import { loadWorksBrowse } from '$lib/server/works-browse';
import { NOVEL_TYPES } from '../../services/api/graphql/works';

/**
 * /light-novels -- the prose shelf: light novels, novels and web novels.
 *
 * One shelf because a reader after a novel does not distinguish them; the
 * scraper's finer label still shows on each work's own page. Named for light
 * novels because that is all but 1% of what is on it.
 *
 * Its own route rather than /manga?types=... so it is linkable, crawlable and
 * nameable. Entries still link to /manga/<slug> for detail; that route serves
 * every kind of work, and a second detail route would mean two URLs per row.
 */
export const load: PageServerLoad = async ({ url, locals, cookies }) =>
  loadWorksBrowse({ types: NOVEL_TYPES, url, locals, cookies });
