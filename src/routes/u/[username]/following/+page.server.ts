import type { PageServerLoad } from './$types';
import { loadFollowList } from '$lib/server/follow-list';

export const load: PageServerLoad = (event) => loadFollowList('following', event);
