import type { Meta, StoryObj } from '@storybook/svelte';
import { QueryClient } from '@tanstack/svelte-query';
import { writable } from 'svelte/store';
import NotificationsBell from './NotificationsBell.svelte';
import { NotificationsBellBloc } from './NotificationsBell.bloc.svelte';

const rows = [
  { id: 'n1', type: 'NEW_FOLLOWER', readAt: null, createdAt: new Date(Date.now() - 5 * 60_000).toISOString(), actor: { id: 'u1', username: 'sakura', firstname: 'Sakura' } },
  { id: 'n2', type: 'FOLLOW_REQUESTED', readAt: null, createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(), actor: { id: 'u2', username: 'tomoyo' } },
  { id: 'n3', type: 'FOLLOW_ACCEPTED', readAt: new Date().toISOString(), createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), actor: { id: 'u3', username: 'kero' } },
];

const bloc = (count: number) =>
  new NotificationsBellBloc({
    port: {
      unreadCount: () => ({ queryKey: ['sb-unread', count], queryFn: async () => count }),
      list: () => ({ queryKey: ['sb-notifications'], queryFn: async () => ({ total: rows.length, notifications: rows }) }),
      markAllRead: async () => true,
    },
    auth: writable({ isLoggedIn: true }),
    queryClient: new QueryClient(),
    pollMs: 1_000_000,
  });

const meta = {
  title: 'Shell/NotificationsBell',
  component: NotificationsBell,
  tags: ['autodocs'],
} satisfies Meta<typeof NotificationsBell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Quiet: Story = { args: { bloc: bloc(0) } };
export const Unread: Story = { args: { bloc: bloc(2) } };
export const ManyUnread: Story = { args: { bloc: bloc(23) } };
