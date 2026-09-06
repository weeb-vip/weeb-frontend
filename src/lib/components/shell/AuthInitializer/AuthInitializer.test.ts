import { describe, it, expect, vi } from 'vitest';
import { readable, writable } from 'svelte/store';
import {
  AuthInitializerBloc,
  windowAuthGlobals,
  type AuthInitializerDeps,
  type SsrAuth,
  type UserQueryPort
} from './AuthInitializer.bloc.svelte';

/**
 * Bringing the session up by whichever of the two routes applies. The invariant
 * that matters most: `setAuthInitialized()` fires exactly once on every path,
 * because everything gated on auth is waiting for it.
 */
const USER = { id: 'u1', username: 'ada', email: 'ada@example.com' };

const ssr = (overrides: Partial<SsrAuth> = {}): SsrAuth => ({
  isLoggedIn: true,
  hasAuthToken: true,
  hasRefreshToken: true,
  authTokenExpiresAt: 1_700_000_000,
  ...overrides
});

function ports(deps: Partial<AuthInitializerDeps> = {}) {
  const session = { setLoggedIn: vi.fn(), logout: vi.fn(), setAuthInitialized: vi.fn() };
  const preferences = { init: vi.fn() };
  const users = { fetch: vi.fn(async () => USER) };
  const refresher = { startWithExpiry: vi.fn(), start: vi.fn() };
  const tokens = {
    getAuthToken: vi.fn(() => 'auth-token'),
    getRefreshToken: vi.fn(() => 'refresh-token'),
    clearTokens: vi.fn()
  };
  const uninstall = vi.fn();
  const globals = { install: vi.fn(() => uninstall) };

  const bloc = new AuthInitializerBloc({
    session,
    preferences,
    users,
    userQuery: () => readable({}) as UserQueryPort,
    refresher,
    tokens,
    globals,
    ...deps
  });

  return { bloc, session, preferences, users, refresher, tokens, globals, uninstall };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 1));

describe('AuthInitializerBloc', () => {
  describe('whichever path is taken', () => {
    it('reads preferences out of storage and publishes the global stores', () => {
      const { bloc, preferences, globals } = ports();

      bloc.start(ssr());

      expect(preferences.init).toHaveBeenCalledTimes(1);
      expect(globals.install).toHaveBeenCalledTimes(1);
    });

    it('hands back a teardown that drops everything it installed', () => {
      const { bloc, uninstall } = ports();

      bloc.start(ssr())();

      // Every mount used to leak another subscription.
      expect(uninstall).toHaveBeenCalledTimes(1);
    });

    it('settles as signed out rather than hanging when the bootstrap throws', () => {
      const { bloc, session } = ports({
        preferences: {
          init: () => {
            throw new Error('no localStorage');
          }
        }
      });

      bloc.start(ssr());

      expect(session.logout).toHaveBeenCalledTimes(1);
      expect(session.setAuthInitialized).toHaveBeenCalledTimes(1);
    });
  });

  describe('with the server’s answer', () => {
    it('believes a signed-in server and identifies the user', async () => {
      const { bloc, session, users } = ports();

      bloc.start(ssr());
      await settle();

      expect(users.fetch).toHaveBeenCalledTimes(1);
      expect(session.setLoggedIn).toHaveBeenCalledWith({
        id: 'u1',
        username: 'ada',
        email: 'ada@example.com'
      });
      expect(session.setAuthInitialized).toHaveBeenCalledTimes(1);
    });

    it('keeps the session when the analytics fetch fails', async () => {
      const { bloc, session } = ports({
        users: { fetch: vi.fn(async () => Promise.reject(new Error('gateway down'))) }
      });

      bloc.start(ssr());
      await settle();

      // They are logged in either way; the fetch is only for identification.
      expect(session.setLoggedIn).toHaveBeenCalledWith();
      expect(session.logout).not.toHaveBeenCalled();
      expect(session.setAuthInitialized).toHaveBeenCalledTimes(1);
    });

    it('schedules the refresh from the expiry the server knows', async () => {
      const { bloc, refresher } = ports();

      bloc.start(ssr());
      await settle();

      expect(refresher.startWithExpiry).toHaveBeenCalledWith(1_700_000_000);
      expect(refresher.start).not.toHaveBeenCalled();
    });

    it('schedules nothing without a refresh token or an expiry', async () => {
      for (const missing of [{ hasRefreshToken: false }, { authTokenExpiresAt: null }]) {
        const { bloc, refresher } = ports();

        bloc.start(ssr(missing));
        await settle();

        expect(refresher.startWithExpiry).not.toHaveBeenCalled();
      }
    });

    it('signs out when the server says nobody is signed in', async () => {
      const { bloc, session, users } = ports();

      bloc.start(ssr({ isLoggedIn: false }));
      await settle();

      expect(session.logout).toHaveBeenCalledTimes(1);
      expect(session.setAuthInitialized).toHaveBeenCalledTimes(1);
      expect(users.fetch).not.toHaveBeenCalled();
    });

    it('signs out when the server has no auth token to work with', async () => {
      const { bloc, session } = ports();

      bloc.start(ssr({ hasAuthToken: false }));
      await settle();

      expect(session.logout).toHaveBeenCalledTimes(1);
    });
  });

  describe('with nothing from the server', () => {
    it('signs in whoever the query identified', () => {
      const query = writable({ isSuccess: true, data: USER });
      const { bloc, session } = ports({ userQuery: () => query as UserQueryPort });

      bloc.start();

      expect(session.setLoggedIn).toHaveBeenCalledWith({
        id: 'u1',
        username: 'ada',
        email: 'ada@example.com'
      });
      expect(session.setAuthInitialized).toHaveBeenCalled();
    });

    it('starts the refresher from storage when there is a refresh token', () => {
      const query = writable({ isSuccess: true, data: USER });
      const { bloc, refresher, tokens } = ports({ userQuery: () => query as UserQueryPort });

      bloc.start();

      expect(refresher.start).toHaveBeenCalledWith('auth-token');
      expect(tokens.getRefreshToken).toHaveBeenCalled();
    });

    it('starts nothing when there is no refresh token to refresh with', () => {
      const query = writable({ isSuccess: true, data: USER });
      const { bloc, refresher } = ports({
        userQuery: () => query as UserQueryPort,
        tokens: {
          getAuthToken: () => null,
          getRefreshToken: () => null,
          clearTokens: vi.fn()
        }
      });

      bloc.start();

      expect(refresher.start).not.toHaveBeenCalled();
    });

    it('signs out and clears stale tokens when the query fails', () => {
      const query = writable({ isError: true, error: { message: 'Access denied' } });
      const { bloc, session, tokens } = ports({ userQuery: () => query as UserQueryPort });

      bloc.start();

      expect(session.logout).toHaveBeenCalledTimes(1);
      expect(tokens.clearTokens).toHaveBeenCalledTimes(1);
      expect(session.setAuthInitialized).toHaveBeenCalled();
    });

    it('marks auth initialised even while the query is still pending', () => {
      const query = writable({});
      const { bloc, session } = ports({ userQuery: () => query as UserQueryPort });

      bloc.start();

      // Whatever the answer, the question has now been asked.
      expect(session.setAuthInitialized).toHaveBeenCalledTimes(1);
      expect(session.setLoggedIn).not.toHaveBeenCalled();
      expect(session.logout).not.toHaveBeenCalled();
    });

    it('unsubscribes from the query on teardown', () => {
      const query = writable({});
      const { bloc, session } = ports({ userQuery: () => query as UserQueryPort });

      const stop = bloc.start();
      stop();
      query.set({ isSuccess: true, data: USER });

      expect(session.setLoggedIn).not.toHaveBeenCalled();
    });

    it('treats a success with no user as unresolved rather than signed in', () => {
      const query = writable({ isSuccess: true, data: null });
      const { bloc, session } = ports({ userQuery: () => query as UserQueryPort });

      bloc.start();

      expect(session.setLoggedIn).not.toHaveBeenCalled();
      expect(session.setAuthInitialized).toHaveBeenCalled();
    });
  });
});

describe('windowAuthGlobals', () => {
  it('publishes the stores the global error path reaches auth through', () => {
    const stop = windowAuthGlobals.install();

    const win = window as typeof window & {
      loggedInStore?: unknown;
      loginModalStore?: unknown;
      loggedInStoreValue?: unknown;
    };
    expect(win.loggedInStore).toBeDefined();
    expect(win.loginModalStore).toBeDefined();
    // And mirrors the current value, so plain code can read it synchronously.
    expect(win.loggedInStoreValue).toBeDefined();

    stop();
  });
});
