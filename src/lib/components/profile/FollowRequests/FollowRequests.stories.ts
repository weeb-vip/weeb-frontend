import type { Meta, StoryObj } from '@storybook/svelte';
import { QueryClient } from '@tanstack/svelte-query';
import { writable } from 'svelte/store';
import FollowRequests from './FollowRequests.svelte';
import { FollowRequestsBloc } from './FollowRequests.bloc.svelte';

const users = [
  { id: 'u1', username: 'sakura', firstname: 'Sakura', lastname: 'Kinomoto', profileImageUrl: null },
  { id: 'u2', username: 'tomoyo', profileImageUrl: null },
];

const bloc = (rows: any[]) =>
  new FollowRequestsBloc({
    port: { list: () => ({ queryKey: ['sb-follow-requests', rows.length], queryFn: async () => ({ total: rows.length, users: rows }) }), accept: async () => true, decline: async () => true },
    auth: writable({ isLoggedIn: true }),
    notify: { error: () => {} },
    queryClient: new QueryClient(),
  });

const meta = {
  title: 'Composites/Profile/FollowRequests',
  component: FollowRequests,
  tags: ['autodocs'],
} satisfies Meta<typeof FollowRequests>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = { args: { bloc: bloc(users) } };
export const None: Story = { args: { bloc: bloc([]) } };
