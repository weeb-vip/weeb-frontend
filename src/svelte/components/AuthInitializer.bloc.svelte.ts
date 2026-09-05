import { createQuery } from '@tanstack/svelte-query';
import type { Readable } from 'svelte/store';
import { loggedInStore, loginModalStore } from '../stores/auth';
import { preferencesStore } from '../stores/preferences';
import { AuthStorage } from '../../utils/auth-storage';
import { TokenRefresher } from '../../services/token_refresher';
import { refreshTokenSimple, getUser } from '../../services/queries';
import { getQueryClient } from '../services/query-client';
import debug from '../../utils/debug';

/* ── Ports ───────────────────────────────────────────────────────────────── */

/** The user fields the session actually carries. */
export interface AuthUser {
  id: string;
  username?: string;
  email?: string | null;
}

/** What the server already worked out about this request, if anything. */
export interface SsrAuth {
  isLoggedIn: boolean;
  hasAuthToken: boolean;
  hasRefreshToken: boolean;
  /** The expiry, never the token itself -- that stays HttpOnly. */
  authTokenExpiresAt: number | null;
}

/** The store every auth-aware surface renders from. */
export interface AuthSessionPort {
  setLoggedIn(user?: { id: string; username?: string; email?: string }): void;
  logout(): void;
  setAuthInitialized(): void;
}

/** Preferences have to be read out of storage before anything renders them. */
export interface PreferencesInitPort {
  init(): void;
}

/** One-shot user fetch. Used on the SSR path purely to identify for analytics. */
export interface UserFetchPort {
  fetch(): Promise<AuthUser>;
}

/**
 * The TanStack query that decides the session when the server told us nothing.
 * A factory, not a store: building it starts a network request, and the SSR
 * path must not pay for one.
 */
export type UserQueryPort = Readable<{
  isSuccess?: boolean;
  isError?: boolean;
  data?: AuthUser | null;
  error?: { message?: string } | null;
}>;

/** Keeping the auth token alive behind the scenes. */
export interface TokenRefreshPort {
  /** The server knows when the token expires; schedule from that. */
  startWithExpiry(expiresAt: number): void;
  start(authToken: string): void;
}

/** The tokens themselves, as far as this component is concerned. */
export interface TokenStoragePort {
  getAuthToken(): string | null;
  getRefreshToken(): string | null;
  clearTokens(): void;
}

/**
 * The auth stores hung off `window`.
 *
 * Not decoration: the global error-toast path is plain code with no component
 * around it, so this is how it reaches the session and the login modal. A port
 * because a story must not scribble on the Storybook window.
 */
export interface AuthGlobalsPort {
  /** Publishes the stores and keeps the current value mirrored. Returns teardown. */
  install(): () => void;
}

/* ── Real implementations ────────────────────────────────────────────────── */

export const realUserFetch: UserFetchPort = {
  fetch: () => getUser().queryFn(),
};

export const realTokenRefresh: TokenRefreshPort = {
  startWithExpiry: (expiresAt) =>
    TokenRefresher.getInstance(async () => refreshTokenSimple()).startWithExpiry(expiresAt),
  start: (authToken) =>
    TokenRefresher.getInstance(async () => refreshTokenSimple()).start(authToken),
};

export const realTokenStorage: TokenStoragePort = {
  getAuthToken: () => AuthStorage.getAuthToken(),
  getRefreshToken: () => AuthStorage.getRefreshToken(),
  clearTokens: () => AuthStorage.clearTokens(),
};

export const windowAuthGlobals: AuthGlobalsPort = {
  install() {
    if (typeof window === 'undefined') return () => {};

    const win = window as typeof window & {
      loggedInStore?: typeof loggedInStore;
      loginModalStore?: typeof loginModalStore;
      loggedInStoreValue?: unknown;
    };
    win.loggedInStore = loggedInStore;
    win.loginModalStore = loginModalStore;

    // Previously subscribed inside an async onMount, which cannot register
    // cleanup -- so every mount leaked another subscription.
    return loggedInStore.subscribe((state) => {
      win.loggedInStoreValue = state;
    });
  },
};

/**
 * The real query. `getQueryClient()` is passed explicitly so this does not have
 * to run during component initialisation to find a client in context.
 */
export function createSessionUserQuery(): UserQueryPort {
  return createQuery(getUser(), getQueryClient()) as unknown as UserQueryPort;
}

/* ── Bloc ────────────────────────────────────────────────────────────────── */

export interface AuthInitializerDeps {
  session?: AuthSessionPort;
  preferences?: PreferencesInitPort;
  users?: UserFetchPort;
  userQuery?: () => UserQueryPort;
  refresher?: TokenRefreshPort;
  tokens?: TokenStoragePort;
  globals?: AuthGlobalsPort;
}

/**
 * Bringing the session up on the client, by whichever of the two routes applies.
 *
 * With SSR auth data the server has already read the HttpOnly cookies, so the
 * session is settled from that and the user fetch is only for analytics
 * identification. Without it there is nothing to trust, so a user query decides:
 * it resolving means signed in, it failing means signed out and stale tokens
 * cleared. Either way `setAuthInitialized()` fires exactly once, because
 * everything gated on auth is waiting for it.
 */
export class AuthInitializerBloc {
  readonly #session: AuthSessionPort;
  readonly #preferences: PreferencesInitPort;
  readonly #users: UserFetchPort;
  readonly #userQuery: () => UserQueryPort;
  readonly #refresher: TokenRefreshPort;
  readonly #tokens: TokenStoragePort;
  readonly #globals: AuthGlobalsPort;

  constructor({
    session = loggedInStore,
    preferences = preferencesStore,
    users = realUserFetch,
    userQuery = createSessionUserQuery,
    refresher = realTokenRefresh,
    tokens = realTokenStorage,
    globals = windowAuthGlobals,
  }: AuthInitializerDeps = {}) {
    this.#session = session;
    this.#preferences = preferences;
    this.#users = users;
    this.#userQuery = userQuery;
    this.#refresher = refresher;
    this.#tokens = tokens;
    this.#globals = globals;
  }

  /**
   * Run the bootstrap. Synchronous so it can hand a teardown straight back to
   * an `$effect`; the fetching it starts settles on its own.
   */
  start(ssrAuth?: SsrAuth): () => void {
    const teardowns: Array<() => void> = [];

    try {
      this.#preferences.init();
      teardowns.push(this.#globals.install());

      if (ssrAuth) {
        void this.#adoptServerSession(ssrAuth);
      } else {
        debug.auth('No SSR auth data - initializing auth state via user details query');
        teardowns.push(this.#adoptQueriedSession());
      }
    } catch (error) {
      debug.error('Auth initialization failed:', error);
      this.#session.logout();
      this.#session.setAuthInitialized();
    }

    return () => teardowns.forEach((stop) => stop());
  }

  /** The server already read the cookies; believe it. */
  async #adoptServerSession(ssrAuth: SsrAuth): Promise<void> {
    try {
      debug.auth('Using SSR auth data - skipping GraphQL user query');

      if (!ssrAuth.isLoggedIn || !ssrAuth.hasAuthToken) {
        debug.auth('SSR data shows user is not logged in');
        this.#session.logout();
        this.#session.setAuthInitialized();
        return;
      }

      debug.success('SSR data shows user is logged in');

      // Only for PostHog identification. A failure here must not cost the
      // visitor their session -- they are logged in either way.
      try {
        const user = await this.#users.fetch();
        this.#session.setLoggedIn({
          id: user.id,
          username: user.username,
          email: user.email ?? undefined,
        });
      } catch (error) {
        debug.warn('Failed to fetch user data for analytics:', error);
        this.#session.setLoggedIn();
      }

      if (ssrAuth.hasRefreshToken && ssrAuth.authTokenExpiresAt) {
        this.#refresher.startWithExpiry(ssrAuth.authTokenExpiresAt);
      }

      this.#session.setAuthInitialized();
    } catch (error) {
      debug.error('Auth initialization failed:', error);
      this.#session.logout();
      this.#session.setAuthInitialized();
    }
  }

  /** Nothing from the server: ask the API who we are. */
  #adoptQueriedSession(): () => void {
    return this.#userQuery().subscribe((result) => {
      if (result.isSuccess && result.data) {
        debug.success('User details fetched successfully - user is logged in');
        this.#session.setLoggedIn({
          id: result.data.id,
          username: result.data.username,
          email: result.data.email ?? undefined,
        });

        if (this.#tokens.getRefreshToken()) {
          this.#refresher.start(this.#tokens.getAuthToken() || '');
        }
      } else if (result.isError) {
        debug.auth('User details query failed - user is not logged in:', result.error?.message);
        this.#session.logout();
        this.#tokens.clearTokens();
      }

      // Whatever the answer, the question has now been asked.
      this.#session.setAuthInitialized();
    });
  }
}
