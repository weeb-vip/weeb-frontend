import type { Readable } from 'svelte/store';
import type { GuestListPort } from '$lib/stores/guestList';

/** The most entries one AddAnimeBatch call takes (list-service MaxBatch). */
export const SYNC_CHUNK = 200;

export interface GuestListSyncDeps {
  auth: Readable<{ isLoggedIn: boolean }>;
  guestList: GuestListPort;
  /** Writes one chunk to the signed-in account with AddAnimeBatch. */
  saveBatch: (inputs: { animeID: string; status: string }[]) => Promise<unknown>;
  /** Called once per sync, with how many of how many saved. */
  onSynced?: (saved: number, total: number) => void;
}

/**
 * Uploads the signed-out list to the account the moment the visitor signs in,
 * by whatever route: the modal, registration then verification, or a page
 * load with a session already in place.
 *
 * Chunks of SYNC_CHUNK through AddAnimeBatch, so a 1,000-show list is five
 * requests rather than a thousand. The server skips shows already on the
 * account, so an import never overwrites a status or score. Each chunk leaves
 * the browser list as it saves; a failed chunk stays for the next sign-in.
 */
export function startGuestListSync({ auth, guestList, saveBatch, onSynced }: GuestListSyncDeps): () => void {
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
      for (let i = 0; i < pending.length; i += SYNC_CHUNK) {
        const chunk = pending.slice(i, i + SYNC_CHUNK);
        try {
          await saveBatch(chunk.map(({ animeID, status }) => ({ animeID, status })));
          chunk.forEach((entry) => guestList.remove(entry.animeID));
          saved += chunk.length;
        } catch {
          // Left on the browser list for the next sign-in.
        }
      }
      if (saved === pending.length) guestList.clear();
      running = false;
      onSynced?.(saved, pending.length);
    }, 0);
  });
}
