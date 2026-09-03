import type { PageServerLoad } from './$types';
import { loadWorksBrowse } from '$lib/server/works-browse';

/**
 * /light-novels -- the light novel shelf.
 *
 * Its own route rather than /manga?type=LIGHT_NOVEL so it is linkable,
 * crawlable and nameable. Entries still link to /manga/<slug> for detail;
 * that route serves every kind of work, and giving light novels a second
 * detail route would mean two URLs for one row.
 */
export const load: PageServerLoad = async ({ url, locals, cookies }) =>
  loadWorksBrowse({ type: 'LIGHT_NOVEL', url, locals, cookies });
