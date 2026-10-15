import { writable, type Readable } from 'svelte/store';

/**
 * A signed-out visitor's list, kept in this browser.
 *
 * "Add to list" used to open the sign-up modal on the first click, which asks
 * for an account before the visitor has any reason to want one. Now the show
 * lands here, the button turns into the status dropdown like it would for a
 * member, and the prompt waits until they have put a few shows on it. When they
 * sign in, `guest-list-sync` uploads the lot to their account and clears it.
 *
 * localStorage rather than session storage so the list is still there when
 * they come back next week. Every read and write is guarded: private windows
 * and blocked site data throw, and the site must work regardless.
 */

export interface GuestEntry {
  animeID: string;
  status: string;
  addedAt: number;
}

export interface GuestListState {
  entries: Record<string, GuestEntry>;
  /** When the "make an account" prompt was last shown. It is shown once. */
  promptedAt: number | null;
}

/** Shows on the list before the sign-up prompt opens by itself. */
export const PROMPT_AT = 3;

const STORAGE_KEY = 'weeb.guest-list.v1';
const EMPTY: GuestListState = { entries: {}, promptedAt: null };

function read(): GuestListState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return { entries: parsed?.entries ?? {}, promptedAt: parsed?.promptedAt ?? null };
  } catch {
    return EMPTY;
  }
}

function write(state: GuestListState): void {
  try {
    if (Object.keys(state.entries).length === 0 && state.promptedAt === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Storage unavailable: the list lives for this page only.
  }
}

export interface GuestListPort extends Readable<GuestListState> {
  /** Adds the show (or keeps its status if it is already there); returns the list size. */
  add(animeID: string, status?: string): number;
  setStatus(animeID: string, status: string): void;
  remove(animeID: string): void;
  /** Records that the sign-up prompt has been shown, so it is not shown again. */
  markPrompted(): void;
  entries(): GuestEntry[];
  clear(): void;
}

export function createGuestList(): GuestListPort {
  const browser = typeof window !== 'undefined';
  let state: GuestListState = browser ? read() : EMPTY;
  const store = writable(state);

  const commit = (next: GuestListState) => {
    state = next;
    store.set(next);
    if (browser) write(next);
  };

  // Another tab added or removed a show: follow it, so two open pages agree.
  if (browser) {
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY) return;
      state = read();
      store.set(state);
    });
  }

  return {
    subscribe: store.subscribe,
    add(animeID, status = 'PLANTOWATCH') {
      if (!state.entries[animeID]) {
        commit({
          ...state,
          entries: { ...state.entries, [animeID]: { animeID, status, addedAt: Date.now() } }
        });
      }
      return Object.keys(state.entries).length;
    },
    setStatus(animeID, status) {
      const entry = state.entries[animeID];
      if (!entry || entry.status === status) return;
      commit({ ...state, entries: { ...state.entries, [animeID]: { ...entry, status } } });
    },
    remove(animeID) {
      if (!state.entries[animeID]) return;
      const { [animeID]: _, ...rest } = state.entries;
      commit({ ...state, entries: rest });
    },
    markPrompted() {
      commit({ ...state, promptedAt: Date.now() });
    },
    entries() {
      return Object.values(state.entries).sort((a, b) => a.addedAt - b.addedAt);
    },
    clear() {
      commit(EMPTY);
    }
  };
}

export const guestList = createGuestList();
