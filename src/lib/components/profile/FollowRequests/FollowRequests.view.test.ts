import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/svelte-query';
import { writable } from 'svelte/store';
import FollowRequests from './FollowRequests.svelte';
import { FollowRequestsBloc } from './FollowRequests.bloc.svelte';

function makeBloc(users: any[]) {
  const accept = vi.fn(async () => true);
  const decline = vi.fn(async () => true);
  const bloc = new FollowRequestsBloc({
    port: { list: (limit) => ({ queryKey: ['follow-requests', 1, limit], queryFn: async () => ({ total: users.length, users }) }), accept, decline },
    auth: writable({ isLoggedIn: true }),
    notify: { error: vi.fn() },
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
  });
  return { bloc, accept, decline };
}

describe('FollowRequests', () => {
  it('renders nothing when there are no requests', async () => {
    const { container } = render(FollowRequests, { props: { bloc: makeBloc([]).bloc } });
    await new Promise((r) => setTimeout(r, 5));
    expect(container.querySelector('section')).toBeNull();
  });

  it('lists requests with accept and decline', async () => {
    const { bloc, accept, decline } = makeBloc([{ id: 'user_alice', username: 'alice', firstname: 'Alice' }, { id: 'user_carol', username: 'carol' }]);
    render(FollowRequests, { props: { bloc } });
    expect(await screen.findByRole('heading', { name: 'Follow requests' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Alice/ })).toHaveAttribute('href', '/u/alice');

    await userEvent.click(screen.getByRole('button', { name: 'Accept alice' }));
    expect(accept).toHaveBeenCalledWith('user_alice');
    await userEvent.click(await screen.findByRole('button', { name: 'Decline carol' }));
    expect(decline).toHaveBeenCalledWith('user_carol');
  });
});
