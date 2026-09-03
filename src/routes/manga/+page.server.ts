import type { PageServerLoad } from './$types';
import { loadWorksBrowse } from '$lib/server/works-browse';

/**
 * /manga -- the manga shelf.
 *
 * Sits alongside /manga/[slug], which is the detail page for the whole work
 * family. This index is manga only: a light novel is a different thing to
 * browse even though it shares the detail route, which is why /light-novels
 * exists rather than a type filter on this page.
 */
export const load: PageServerLoad = async ({ url, locals, cookies }) =>
  loadWorksBrowse({ type: 'MANGA', url, locals, cookies });
