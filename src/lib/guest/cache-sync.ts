import { derived, type Readable } from 'svelte/store';
import type { QueryClient } from '@tanstack/svelte-query';
import { loggedInStore } from '$lib/stores/auth';
import { guestList, type GuestListState } from '$lib/stores/guestList';
import { overlayGuestList } from './overlay';
import { isGuest } from './active';

type AuthState = { isLoggedIn: boolean; isAuthInitialized: boolean };

/**
 * Keeps cached query data in step with the browser list. The interceptor
 * covers responses that arrive later; this covers what is already cached:
 * queries that finished before auth resolved, and every cached response when
 * the visitor adds, changes or removes a show. No refetch: the cache is
 * rewritten in place, and only queries the overlay actually changed are set.
 */
export function startGuestCacheSync(
  queryClient: QueryClient,
  auth: Readable<AuthState> = loggedInStore,
  list: Readable<GuestListState> = guestList
): () => void {
  return derived([auth, list], ([a, l]) => (isGuest(a) ? l.entries : null)).subscribe((entries) => {
    if (!entries) return;
    for (const query of queryClient.getQueryCache().getAll()) {
      const data = query.state.data;
      if (data === undefined) continue;
      const next = overlayGuestList(data, entries);
      if (next !== data) queryClient.setQueryData(query.queryKey, next);
    }
  });
}
