import { describe, it, expect, vi } from 'vitest';
import { writable } from 'svelte/store';
import { FollowButtonBloc, type FollowTarget, type FollowPort } from './FollowButton.bloc.svelte';

/**
 * The Follow button: one click does the natural thing for the state the page
 * came with, and the result of that click sticks to the user it was for.
 */

function target(overrides: Partial<FollowTarget> = {}): FollowTarget {
  return { userID: 'user_bob', username: 'bob', status: 'NONE', followApprovalRequired: false, ...overrides };
}

function port(overrides: Partial<FollowPort> = {}): FollowPort & { follow: ReturnType<typeof vi.fn>; unfollow: ReturnType<typeof vi.fn> } {
  return {
    follow: vi.fn(async () => 'FOLLOWING'),
    unfollow: vi.fn(async () => true),
    ...overrides,
  } as any;
}

function makeBloc(deps: Partial<ConstructorParameters<typeof FollowButtonBloc>[0]> = {}, loggedIn = true) {
  const auth = writable({ isLoggedIn: loggedIn });
  const prompt = { requireAuth: vi.fn() };
  const notify = { error: vi.fn() };
  const bloc = new FollowButtonBloc({ source: () => target(), port: port(), auth, prompt, notify, ...deps });
  return { bloc, auth, prompt, notify };
}

describe('FollowButtonBloc', () => {
  it('starts from the status the page came with', () => {
    const { bloc } = makeBloc({ source: () => target({ status: 'FOLLOWING' }) });
    expect(bloc.status).toBe('FOLLOWING');
    expect(bloc.label).toBe('Following');
    expect(bloc.isActive).toBe(true);
    expect(bloc.ariaLabel).toBe('Unfollow bob');
  });

  it('is not shown on your own page', () => {
    const { bloc } = makeBloc({ source: () => target({ status: 'SELF' }) });
    expect(bloc.isVisible).toBe(false);
  });

  it('follows an open account and counts the new follower', async () => {
    const p = port();
    const onCount = vi.fn();
    const { bloc } = makeBloc({ port: p, onFollowerCountChange: onCount });

    await bloc.toggle();

    expect(p.follow).toHaveBeenCalledWith('user_bob');
    expect(bloc.status).toBe('FOLLOWING');
    expect(onCount).toHaveBeenCalledWith(1);
  });

  it('shows Requested when the account needs approval, without counting', async () => {
    const p = port({ follow: vi.fn(async () => 'REQUESTED') });
    const onCount = vi.fn();
    const { bloc } = makeBloc({ port: p, source: () => target({ followApprovalRequired: true }), onFollowerCountChange: onCount });

    await bloc.toggle();

    expect(bloc.status).toBe('REQUESTED');
    expect(bloc.label).toBe('Requested');
    expect(bloc.ariaLabel).toBe('Withdraw follow request to bob');
    expect(onCount).not.toHaveBeenCalled();
  });

  it('unfollows from Following and counts the loss', async () => {
    const p = port();
    const onCount = vi.fn();
    const { bloc } = makeBloc({ port: p, source: () => target({ status: 'FOLLOWING' }), onFollowerCountChange: onCount });

    await bloc.toggle();

    expect(p.unfollow).toHaveBeenCalledWith('user_bob');
    expect(bloc.status).toBe('NONE');
    expect(onCount).toHaveBeenCalledWith(-1);
  });

  it('withdrawing a request does not touch the follower count', async () => {
    const onCount = vi.fn();
    const { bloc } = makeBloc({ source: () => target({ status: 'REQUESTED' }), onFollowerCountChange: onCount });

    await bloc.toggle();

    expect(bloc.status).toBe('NONE');
    expect(onCount).not.toHaveBeenCalled();
  });

  it('asks a signed-out visitor to sign in and replays the follow afterwards', async () => {
    const p = port();
    const { bloc, prompt, auth } = makeBloc({ port: p }, false);

    await bloc.toggle();

    expect(p.follow).not.toHaveBeenCalled();
    expect(prompt.requireAuth).toHaveBeenCalledWith(expect.objectContaining({ reason: 'Sign in to follow @bob' }));

    auth.set({ isLoggedIn: true });
    await prompt.requireAuth.mock.calls[0][0].onAuthed();
    expect(p.follow).toHaveBeenCalledWith('user_bob');
    expect(bloc.status).toBe('FOLLOWING');
  });

  it('keeps the state on a failure and tells the viewer', async () => {
    const p = port({ follow: vi.fn(async () => { throw { response: { errors: [{ extensions: { message: 'That user does not exist' } }] } }; }) });
    const { bloc, notify } = makeBloc({ port: p });

    await bloc.toggle();

    expect(bloc.status).toBe('NONE');
    expect(bloc.isPending).toBe(false);
    expect(notify.error).toHaveBeenCalledWith('That user does not exist');
  });

  it('does not carry one user\'s result to another page', async () => {
    let current = target();
    const { bloc } = makeBloc({ source: () => current });

    await bloc.toggle();
    expect(bloc.status).toBe('FOLLOWING');

    current = target({ userID: 'user_carol', username: 'carol', status: 'NONE' });
    expect(bloc.status).toBe('NONE');
  });

  it('ignores a second click while the first is in flight', async () => {
    let resolve!: (value: string) => void;
    const p = port({ follow: vi.fn(() => new Promise<string>((r) => { resolve = r; })) });
    const { bloc } = makeBloc({ port: p });

    const first = bloc.toggle();
    await bloc.toggle();
    expect(p.follow).toHaveBeenCalledTimes(1);
    resolve('FOLLOWING');
    await first;
    expect(bloc.status).toBe('FOLLOWING');
  });
});
