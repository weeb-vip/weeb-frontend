import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ProfileMenuContentBloc,
  logoutButtonClass,
  menuItemClass,
  userSectionClass,
  type ProfileMenuContentDeps
} from './ProfileMenuContent.bloc.svelte';

function makeBloc(deps: Partial<ProfileMenuContentDeps> = {}) {
  return new ProfileMenuContentBloc({
    service: { signOut: vi.fn(async () => {}) },
    session: { clear: vi.fn() },
    navigate: vi.fn(),
    ...deps
  });
}

describe('ProfileMenuContentBloc', () => {
  let errors: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errors.mockRestore());

  it('is not signing out until asked', () => {
    expect(makeBloc().isSigningOut).toBe(false);
  });

  it('ends the server session, clears the client, then leaves', async () => {
    const order: string[] = [];
    const bloc = makeBloc({
      service: { signOut: vi.fn(async () => void order.push('server')) },
      session: { clear: vi.fn(() => order.push('client')) },
      navigate: vi.fn(() => order.push('navigate'))
    });

    await bloc.signOut();

    // Clearing first would leave a live server session with no token to end it.
    expect(order).toEqual(['server', 'client', 'navigate']);
  });

  it('goes home', async () => {
    const navigate = vi.fn();

    await makeBloc({ navigate }).signOut();

    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('closes the surface that hosts the menu before navigating', async () => {
    const order: string[] = [];
    const bloc = makeBloc({ navigate: vi.fn(() => order.push('navigate')) });

    await bloc.signOut(() => order.push('close'));

    // Otherwise the panel animates out over the new page.
    expect(order).toEqual(['close', 'navigate']);
  });

  it('is signing out while the server call is in flight', async () => {
    let release!: () => void;
    const bloc = makeBloc({
      service: { signOut: vi.fn(() => new Promise<void>((resolve) => (release = resolve))) }
    });

    const inFlight = bloc.signOut();
    expect(bloc.isSigningOut).toBe(true);

    release();
    await inFlight;
    expect(bloc.isSigningOut).toBe(false);
  });

  it('ignores a second click while the first is still running', async () => {
    let release!: () => void;
    const signOut = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const bloc = makeBloc({ service: { signOut } });

    const inFlight = bloc.signOut();
    await bloc.signOut();

    expect(signOut).toHaveBeenCalledTimes(1);
    release();
    await inFlight;
  });

  it('does not strand a half-signed-in user when the server call fails', async () => {
    const session = { clear: vi.fn() };
    const navigate = vi.fn();
    const bloc = makeBloc({
      service: { signOut: vi.fn(async () => Promise.reject(new Error('gateway down'))) },
      session,
      navigate
    });

    await bloc.signOut();

    expect(session.clear).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/');
    expect(bloc.isSigningOut).toBe(false);
  });

  it('can be used again after a failure', async () => {
    const signOut = vi.fn(async () => Promise.reject(new Error('gateway down')));
    const bloc = makeBloc({ service: { signOut } });

    await bloc.signOut();
    await bloc.signOut();

    expect(signOut).toHaveBeenCalledTimes(2);
  });
});

describe('the two presentations of one menu', () => {
  const rows = [userSectionClass, menuItemClass, logoutButtonClass];

  it('draws every row differently on mobile than on desktop', () => {
    for (const row of rows) {
      expect(row(true)).not.toBe(row(false));
    }
  });

  it('gives the mobile menu the taller touch padding', () => {
    expect(menuItemClass(true)).toContain('py-3');
    expect(menuItemClass(false)).toContain('py-2');
  });

  it('keeps sign-out in the danger colour in both', () => {
    expect(logoutButtonClass(true)).toContain('text-weeb-red');
    expect(logoutButtonClass(false)).toContain('text-weeb-red');
  });
});
