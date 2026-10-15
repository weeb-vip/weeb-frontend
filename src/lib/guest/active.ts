import { get, type Readable } from 'svelte/store';
import { loggedInStore } from '$lib/stores/auth';
import { guestList, type GuestEntry, type GuestListState } from '$lib/stores/guestList';

type AuthState = { isLoggedIn: boolean; isAuthInitialized: boolean };

/**
 * Whether the browser list stands in for the account: only once auth has
 * resolved to signed out. Before that the server's HTML is still on screen and
 * must be matched exactly, and a returning member reads as signed out too.
 */
export const isGuest = (auth: AuthState) => auth.isAuthInitialized && !auth.isLoggedIn;

/** The browser list to overlay right now, or null when it does not apply. */
export function activeGuestEntries(
  auth: Readable<AuthState> = loggedInStore,
  list: Readable<GuestListState> = guestList
): Readonly<Record<string, GuestEntry>> | null {
  return isGuest(get(auth)) ? get(list).entries : null;
}
