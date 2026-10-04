import { describe, it, expect } from 'vitest';
import { readable } from 'svelte/store';
import {
  fallbackUserFor,
  UserProfileWrapperBloc,
  type ProfileUser
} from './UserProfileWrapper.bloc.svelte';

/**
 * These assertions used to run against a copy of `fallbackUserFor` pasted into
 * this file, because ts-jest could not load a `.svelte.ts` runes module and the
 * bloc is one. A copy can drift from the original without anything failing,
 * which is the opposite of what a test is for.
 *
 * Vitest compiles the module through vite-plugin-svelte, so the real bloc --
 * runes, `fromStore` and all -- is imported directly, and `displayUser` and
 * `status` are read off the real class rather than off a second copy of the
 * rules. There is no mirror left in this file.
 */

/** The bloc with its four ports stubbed; only the two reactive ones matter here. */
function bloc(
  isLoggedIn: boolean,
  query: { data?: ProfileUser | null; isLoading?: boolean; isError?: boolean }
) {
  return new UserProfileWrapperBloc({
    auth: readable({ isLoggedIn }),
    userQuery: readable(query),
    drawer: { open: () => {} },
    prompt: { requestLogin: () => {}, requestRegister: () => {} }
  });
}

describe('UserProfileWrapper logic', () => {
  describe('fallback user', () => {
    it('stands in for a failed user query while logged in', () => {
      expect(fallbackUserFor(true, true)).toEqual({ username: 'User', profileImageUrl: null });
    });

    it('covers ANY failure, not only "Access denied"', () => {
      // The old rule matched on the error message, so a network error or a 500
      // produced no user at all and the header pulsed forever.
      expect(fallbackUserFor(true, true)).not.toBeNull();
    });

    it('is not used when nobody is logged in', () => {
      expect(fallbackUserFor(false, true)).toBeNull();
    });

    it('is not used when the query succeeded', () => {
      expect(fallbackUserFor(true, false)).toBeNull();
    });
  });

  describe('display user', () => {
    it('prefers real user data over the fallback', () => {
      const realUser = { username: 'realuser', profileImageUrl: 'real.jpg' } as ProfileUser;

      expect(bloc(true, { data: realUser, isError: true }).displayUser).toEqual(realUser);
    });

    it('falls back when the query returned nothing and failed', () => {
      expect(bloc(true, { data: null, isError: true }).displayUser).toEqual({
        username: 'User',
        profileImageUrl: null
      });
    });

    it('is null when the query returned nothing and did not fail', () => {
      expect(bloc(true, { isError: false }).displayUser).toBeNull();
    });
  });

  describe('status', () => {
    it('is signed-out before anything is loaded', () => {
      expect(bloc(false, {}).status).toBe('signed-out');
    });

    it('is loading only while logged in', () => {
      expect(bloc(true, { isLoading: true }).status).toBe('loading');
      expect(bloc(false, { isLoading: true }).status).toBe('signed-out');
    });

    it('is ready once there is someone to render', () => {
      const user = { username: 'User', profileImageUrl: null } as ProfileUser;

      expect(bloc(true, { data: user }).status).toBe('ready');
    });

    it('is stuck when the query settled with no user at all', () => {
      // The state that must NOT pulse: nothing is going to resolve it.
      expect(bloc(true, { data: null, isLoading: false, isError: false }).status).toBe('stuck');
    });
  });
});

describe("the server's answer, before the client store has resolved", () => {
  const unresolved = (isLoggedIn = false) => readable({ isLoggedIn, isAuthInitialized: false });
  const resolved = (isLoggedIn: boolean) => readable({ isLoggedIn, isAuthInitialized: true });
  const make = (auth: ReturnType<typeof unresolved>, serverAuth: { isLoggedIn: boolean } | null, query = {}) =>
    new UserProfileWrapperBloc({
      auth,
      serverAuth,
      userQuery: readable(query),
      drawer: { open: () => {} },
      prompt: { requestLogin: () => {}, requestRegister: () => {} }
    });

  it('renders the signed-in placeholder for a signed-in server, not Login/Register', () => {
    const bloc = make(unresolved(), { isLoggedIn: true });
    expect(bloc.isLoggedIn).toBe(true);
    expect(bloc.status).toBe('loading');
  });

  it('stays signed out when the server said so', () => {
    expect(make(unresolved(), { isLoggedIn: false }).status).toBe('signed-out');
  });

  it('is ready once the user details are in, even before the store resolves', () => {
    const bloc = make(unresolved(), { isLoggedIn: true }, { data: { id: 'u1', username: 'ada', firstname: 'A', lastname: 'L' } });
    expect(bloc.status).toBe('ready');
  });

  it('lets the resolved client store win over the server', () => {
    expect(make(resolved(false), { isLoggedIn: true }).status).toBe('signed-out');
    expect(make(resolved(true), { isLoggedIn: false }, { isError: true }).status).toBe('ready');
  });

  it('behaves as before without a server answer', () => {
    expect(make(unresolved(), null).status).toBe('signed-out');
  });
});

describe('the header slot as the server renders it', () => {
  it('shows the placeholder rather than Login/Register for a signed-in response', async () => {
    const { render, screen } = await import('@testing-library/svelte');
    const { default: UserProfileWrapper } = await import('./UserProfileWrapper.svelte');
    const bloc = new UserProfileWrapperBloc({
      auth: readable({ isLoggedIn: false, isAuthInitialized: false }),
      serverAuth: { isLoggedIn: true },
      userQuery: readable({}),
      drawer: { open: () => {} },
      prompt: { requestLogin: () => {}, requestRegister: () => {} }
    });

    const { container } = render(UserProfileWrapper, { props: { bloc } });

    expect(screen.queryByRole('button', { name: 'Login' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Register' })).toBeNull();
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });
});
