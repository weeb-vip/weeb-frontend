import { fromStore, type Readable } from 'svelte/store';
import { loggedInStore } from '$lib/stores/auth';
import { guestList, type GuestListState } from '$lib/stores/guestList';
import { overlayGuestList } from './overlay';
import { isGuest } from './active';

/**
 * For server-rendered page data, which never passes through the browser's
 * GraphQL client. Call once while a page initialises and wrap what it hands
 * its bloc: `homeData: guest(data.homeData)`.
 *
 * It returns the data untouched until auth resolves in the browser, which is
 * after hydration, so the first client render matches the server HTML. Then
 * it reads the browser list reactively: a `$derived` over it re-runs when the
 * visitor adds or removes a show.
 */
export function createPageGuestOverlay(
  auth: Readable<{ isLoggedIn: boolean; isAuthInitialized: boolean }> = loggedInStore,
  list: Readable<GuestListState> = guestList
) {
  const a = fromStore(auth);
  const l = fromStore(list);
  return <T>(data: T): T => (isGuest(a.current) ? overlayGuestList(data, l.current.entries) : data);
}
