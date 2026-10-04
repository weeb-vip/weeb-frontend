import { getContext, setContext } from 'svelte';

/**
 * The server's answer about the visitor, for the first render.
 *
 * `loggedInStore` is a module singleton that starts signed out and is only
 * ever set in the browser, so everything gated on it rendered the signed-out
 * state on the server -- a logged-in response carried Login/Register buttons,
 * no bell, and a feed page saying "Sign in" above the feed items it had
 * already fetched -- and corrected itself only after hydration plus a user
 * fetch. The server already read the cookies; this hands that answer down as
 * a per-request value (Svelte context, never the shared store) so components
 * can believe it until the client store has resolved.
 */
export interface ServerAuth {
  isLoggedIn: boolean;
}

/** The subset of `loggedInStore` the resolution reads. */
export interface ClientAuthState {
  isLoggedIn: boolean;
  /** Absent in test stubs: treated as resolved, so the store wins as before. */
  isAuthInitialized?: boolean;
}

const KEY = 'weeb:server-auth';

/** Called once by the root layout, during its init. */
export function provideServerAuth(auth: ServerAuth | null | undefined): void {
  setContext(KEY, auth ? { isLoggedIn: Boolean(auth.isLoggedIn) } : null);
}

/**
 * The value the layout provided, or null when read outside a component tree
 * (stories, tests, a bloc built in isolation).
 */
export function serverAuthFromContext(): ServerAuth | null {
  try {
    return (getContext<ServerAuth | null>(KEY) ?? null) as ServerAuth | null;
  } catch {
    return null;
  }
}

/**
 * Who to render for: the client store once it has resolved, else the server.
 * A cached anonymous page says signed out, and the client takes over at
 * hydration -- exactly the behaviour before, for that case.
 */
export function resolveLoggedIn(store: ClientAuthState, server: ServerAuth | null | undefined): boolean {
  if (store.isAuthInitialized === false && server) return server.isLoggedIn;
  return store.isLoggedIn;
}
