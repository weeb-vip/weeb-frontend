import type { GuestEntry } from '$lib/stores/guestList';

/** The id prefix that marks a `userAnime` the overlay made, not the server. */
export const GUEST_ID_PREFIX = 'guest:';

/**
 * A stand-in from the browser list rather than a row on an account. It says
 * the show is on the list, but there is nothing behind it to track episodes
 * or a score against, so tracking controls must stay off for it.
 */
export function isGuestStandIn(userAnime: { id?: string | null } | null | undefined): boolean {
  return typeof userAnime?.id === 'string' && userAnime.id.startsWith(GUEST_ID_PREFIX);
}

/** The `userAnime` a signed-out visitor's browser list stands in for. */
export function guestUserAnime(entry: GuestEntry) {
  return {
    __typename: 'UserAnime' as const,
    id: `${GUEST_ID_PREFIX}${entry.animeID}`,
    animeID: entry.animeID,
    status: entry.status,
    score: null,
    episodes: null
  };
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/**
 * Puts a signed-out visitor's browser list into GraphQL-shaped data, so every
 * part of the site that reads `anime.userAnime` sees it without knowing the
 * list exists.
 *
 * An anime is any object with an `id` and a `userAnime` key: the key is only
 * there when the query asked for list status, and only `Anime` has the field.
 * One the visitor saved gets a stand-in `userAnime`; one they took off again
 * loses the stand-in it was given earlier; a real `userAnime` from the server
 * is never touched.
 *
 * Unchanged branches keep their identity, so a cached response with nothing
 * to change comes back as the very same object and nothing re-renders.
 */
export function overlayGuestList<T>(data: T, entries: Readonly<Record<string, GuestEntry>>): T {
  return walk(data, entries) as T;
}

function walk(value: unknown, entries: Readonly<Record<string, GuestEntry>>): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const out = walk(item, entries);
      if (out !== item) changed = true;
      return out;
    });
    return changed ? next : value;
  }
  if (!isPlainObject(value)) return value;

  let next: Record<string, unknown> | null = null;
  for (const key of Object.keys(value)) {
    const child = value[key];
    const out = walk(child, entries);
    if (out !== child) (next ??= { ...value })[key] = out;
  }

  const target = next ?? value;
  if (typeof target.id === 'string' && 'userAnime' in target) {
    const current = target.userAnime as { id?: string; status?: string } | null | undefined;
    const entry = entries[target.id];
    const isStandIn = typeof current?.id === 'string' && current.id.startsWith(GUEST_ID_PREFIX);

    if (entry && (!current || isStandIn)) {
      if (!isStandIn || current?.status !== entry.status) {
        (next ??= { ...value }).userAnime = guestUserAnime(entry);
      }
    } else if (!entry && isStandIn) {
      (next ??= { ...value }).userAnime = null;
    }
  }

  return next ?? value;
}
