import type { Readable } from 'svelte/store';
import type { GuestListPort } from '$lib/stores/guestList';

export interface GuestListSyncDeps {
  auth: Readable<{ isLoggedIn: boolean }>;
  guestList: GuestListPort;
  /** Writes one entry to the signed-in account. */
  save: (input: { animeID: string; status: string }) => Promise<unknown>;
  /** Called once per sync, with how many of how many saved. */
  onSynced?: (saved: number, total: number) => void;
}

/**
 * Uploads the signed-out list to the account the moment the visitor signs in,
 * by whatever route: the modal, registration then verification, or a page
 * load with a session already in place. Entries are removed one by one as
 * they save, so a failure leaves only what did not make it, and the next
 * sign-in tries those again.
 */
export function startGuestListSync({ auth, guestList, save, onSynced }: GuestListSyncDeps): () => void {
  let wasLoggedIn = false;
  let running = false;

  return auth.subscribe((state) => {
    const justAuthed = state.isLoggedIn && !wasLoggedIn;
    wasLoggedIn = state.isLoggedIn;
    if (!justAuthed || running) return;

    const pending = guestList.entries();
    if (pending.length === 0) return;

    running = true;
    // Deferred a tick, like the login intent replay, so the auth token is in
    // place before the first write goes out.
    setTimeout(async () => {
      let saved = 0;
      for (const entry of pending) {
        try {
          await save({ animeID: entry.animeID, status: entry.status });
          guestList.remove(entry.animeID);
          saved++;
        } catch {
          // Left on the guest list for the next sign-in.
        }
      }
      if (saved === pending.length) guestList.clear();
      running = false;
      onSynced?.(saved, pending.length);
    }, 0);
  });
}
