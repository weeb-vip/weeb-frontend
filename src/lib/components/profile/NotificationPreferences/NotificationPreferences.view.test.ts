import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/svelte-query';
import { writable } from 'svelte/store';
import NotificationPreferences from './NotificationPreferences.svelte';
import { NotificationPreferencesBloc } from './NotificationPreferences.bloc.svelte';

function makeBloc() {
  const update = vi.fn(async (input: any) => input);
  const bloc = new NotificationPreferencesBloc({
    port: { list: () => ({ queryKey: ['notification-preferences'], queryFn: async () => [{ type: 'NEW_FOLLOWER', channel: 'EMAIL', enabled: true }] }), update },
    auth: writable({ isLoggedIn: true }),
    notify: { error: vi.fn() },
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
  });
  return { bloc, update };
}

describe('NotificationPreferences', () => {
  it('renders a switch per type and channel, reflecting stored and default values', async () => {
    render(NotificationPreferences, { props: { bloc: makeBloc().bloc } });
    const email = await screen.findByRole('switch', { name: 'New followers: Email' });
    expect(email).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'New followers: Push' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Follow requests: In app' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('switch')).toHaveLength(9);
  });

  it('saves a flip straight away', async () => {
    const { bloc, update } = makeBloc();
    render(NotificationPreferences, { props: { bloc } });
    const push = await screen.findByRole('switch', { name: 'Follow requests: Push' });
    await userEvent.click(push);
    expect(update).toHaveBeenCalledWith({ type: 'FOLLOW_REQUESTED', channel: 'PUSH', enabled: true });
    expect(push).toHaveAttribute('aria-checked', 'true');
  });
});
