import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/svelte-query';
import { writable } from 'svelte/store';
import NotificationsBell from './NotificationsBell.svelte';
import { NotificationsBellBloc } from './NotificationsBell.bloc.svelte';

function makeBloc(count: number, loggedIn = true) {
  const markAllRead = vi.fn(async () => true);
  const bloc = new NotificationsBellBloc({
    port: {
      unreadCount: () => ({ queryKey: ['unread-notification-count'], queryFn: async () => count }),
      list: (limit) => ({ queryKey: ['notifications', 1, limit, false], queryFn: async () => ({ total: 1, notifications: [
        { id: 'n1', type: 'NEW_FOLLOWER', readAt: null, createdAt: new Date().toISOString(), actor: { id: 'user_bob', username: 'bob' } },
      ] }) }),
      markAllRead,
    },
    auth: writable({ isLoggedIn: loggedIn }),
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
    pollMs: 100_000,
  });
  return { bloc, markAllRead };
}

describe('NotificationsBell', () => {
  it('is absent for a signed-out visitor', () => {
    render(NotificationsBell, { props: { bloc: makeBloc(0, false).bloc } });
    expect(screen.queryByRole('button', { name: /Notifications/ })).toBeNull();
  });

  it('shows the unread count in the badge and the accessible name', async () => {
    render(NotificationsBell, { props: { bloc: makeBloc(3).bloc } });
    expect(await screen.findByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument();
    expect(screen.getByTestId('bell-badge')).toHaveTextContent('3');
  });

  it('opens a panel with the newest notifications and marks them read', async () => {
    const { bloc, markAllRead } = makeBloc(1);
    render(NotificationsBell, { props: { bloc } });
    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    expect(await screen.findByRole('link', { name: /bob started following you/ })).toHaveAttribute('href', '/u/bob');
    await userEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    expect(markAllRead).toHaveBeenCalledTimes(1);
  });
});
