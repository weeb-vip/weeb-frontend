import { untrack } from 'svelte';

/**
 * What the five App Shell provider stories share.
 *
 * A provider draws nothing, so every one of those stories is a provider with a
 * probe child inside it and a panel reporting what the child saw. Two things
 * are common to all of them: the fixtures the stubbed auth ports answer with,
 * and a way to both PROVE and ENFORCE that nothing left the browser -- these
 * are the components that stand up a query client, refresh a token and warm a
 * GraphQL socket, so "offline" has to be more than an intention.
 */

/** The user every signed-in provider story resolves to. */
export const SESSION_USER = {
  id: 'u-42',
  username: 'sakura',
  firstname: 'Sakura',
  lastname: 'Kinomoto',
  email: 'sakura@example.com',
  profileImageUrl: null,
};

/** The server's answer for a story that arrives with a session already resolved. */
export const SSR_SIGNED_IN = {
  isLoggedIn: true,
  hasAuthToken: true,
  hasRefreshToken: true,
  /** Fixed, so the scheduled refresh reads the same in every screenshot. */
  authTokenExpiresAt: 1_800_000_000_000,
};

/**
 * Counts every `fetch` a story makes and refuses the ones that would leave the
 * Storybook origin -- the GraphQL gateway, Algolia, the CDN.
 *
 * `record` is what makes the guarantee visible rather than merely claimed: each
 * panel renders the count, and 0 is the assertion. Same-origin requests are
 * passed through untouched so Storybook's own iframe keeps working; the app has
 * exactly one of those (`/config.json`) and `ConfigProvider` exists so that it
 * is never made.
 *
 * Returns the teardown, for an `$effect` to hand back.
 */
export function installOfflineFetch(record: (url: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const real = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    // A request can be made from inside a component's own `$effect`. Counting
    // it must not make that effect depend on the counter, or the write would
    // re-run the effect and the request with it.
    untrack(() => record(url));

    if (url.startsWith('/') || url.startsWith(window.location.origin)) {
      return real(input as RequestInfo, init);
    }

    // Answered rather than rejected: a fire-and-forget warm-up swallows a
    // rejection, but a component that awaited one would show an error state
    // that belongs to the story's plumbing rather than to the component.
    return new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  return () => {
    globalThis.fetch = real;
  };
}

/** A row in a `ProviderPanel`. */
export interface PanelRow {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad' | 'plain';
}

/** The network row every provider panel ends with. */
export function networkRow(requests: number): PanelRow {
  return {
    label: 'fetch calls while mounted',
    value: String(requests),
    tone: requests === 0 ? 'ok' : 'bad',
  };
}

/**
 * The five paths `AuthInitializer` can settle down: the server having already
 * read the cookies (signed in, signed out, or signed in with the analytics
 * fetch failing), and nothing from the server at all (the user query answering,
 * or failing).
 */
export type AuthScenario =
  | 'server-signed-in'
  | 'server-signed-out'
  | 'server-analytics-fails'
  | 'query-signed-in'
  | 'query-fails';

/**
 * The slice of the anime notification store the countdowns and episode toasts
 * render from. Declared here rather than imported because the real interface is
 * private to `$lib/stores/animeNotifications` -- only these fields are read.
 */
export interface NotificationStoreShape {
  timingData: Record<string, { countdown: string; isAiring: boolean; airDateTime: string }>;
  countdowns: Record<string, { countdown: string; isAiring: boolean; hasAired: boolean }>;
  isReady: boolean;
}

/** What the store looks like once the manager has started and the worker has reported. */
export const NOTIFICATIONS_READY: NotificationStoreShape = {
  timingData: {
    'frieren-28': { countdown: '00:12:41', isAiring: false, airDateTime: '2026-01-12T14:00:00Z' },
    'apothecary-9': { countdown: '01:47:03', isAiring: false, airDateTime: '2026-01-12T15:30:00Z' },
  },
  countdowns: {
    'frieren-28': { countdown: '00:12:41', isAiring: false, hasAired: false },
    'apothecary-9': { countdown: '01:47:03', isAiring: false, hasAired: false },
  },
  isReady: true,
};

/** The store before anything has started it. */
export const NOTIFICATIONS_EMPTY: NotificationStoreShape = {
  timingData: {},
  countdowns: {},
  isReady: false,
};
