import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { writable } from 'svelte/store';
import FollowButton from './FollowButton.svelte';
import { FollowButtonBloc, type FollowTarget } from './FollowButton.bloc.svelte';

const target = (status: FollowTarget['status']): FollowTarget => ({ userID: 'user_bob', username: 'bob', status, followApprovalRequired: false });

function makeBloc(status: FollowTarget['status'], follow = vi.fn(async () => 'FOLLOWING')) {
  return new FollowButtonBloc({
    source: () => target(status),
    port: { follow, unfollow: vi.fn(async () => true) },
    auth: writable({ isLoggedIn: true }),
    prompt: { requireAuth: vi.fn() },
    notify: { error: vi.fn() },
  });
}

describe('FollowButton', () => {
  it('reads Follow with an accessible name for the person', () => {
    render(FollowButton, { props: { target: target('NONE'), bloc: makeBloc('NONE') } });
    expect(screen.getByRole('button', { name: 'Follow bob' })).toHaveTextContent('Follow');
  });

  it('reads Following, and offers to unfollow', () => {
    render(FollowButton, { props: { target: target('FOLLOWING'), bloc: makeBloc('FOLLOWING') } });
    expect(screen.getByRole('button', { name: 'Unfollow bob' })).toHaveTextContent('Following');
  });

  it('is absent on your own page', () => {
    render(FollowButton, { props: { target: target('SELF'), bloc: makeBloc('SELF') } });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('follows on click', async () => {
    const follow = vi.fn(async () => 'FOLLOWING');
    render(FollowButton, { props: { target: target('NONE'), bloc: makeBloc('NONE', follow) } });
    await userEvent.click(screen.getByRole('button', { name: 'Follow bob' }));
    expect(follow).toHaveBeenCalledWith('user_bob');
    expect(await screen.findByRole('button', { name: 'Unfollow bob' })).toBeInTheDocument();
  });
});
