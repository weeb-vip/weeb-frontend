import type { Meta, StoryObj } from '@storybook/svelte';
import { QueryClient } from '@tanstack/svelte-query';
import { writable } from 'svelte/store';
import NotificationPreferences from './NotificationPreferences.svelte';
import { NotificationPreferencesBloc } from './NotificationPreferences.bloc.svelte';

const bloc = (rows: any[]) =>
  new NotificationPreferencesBloc({
    port: { list: () => ({ queryKey: ['sb-notification-preferences', rows.length], queryFn: async () => rows }), update: async (input) => input },
    auth: writable({ isLoggedIn: true }),
    notify: { error: () => {} },
    queryClient: new QueryClient(),
  });

const meta = {
  title: 'Composites/Profile/NotificationPreferences',
  component: NotificationPreferences,
  tags: ['autodocs'],
} satisfies Meta<typeof NotificationPreferences>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Defaults: Story = { args: { bloc: bloc([]) } };
export const WithEmailOn: Story = { args: { bloc: bloc([{ type: 'NEW_FOLLOWER', channel: 'EMAIL', enabled: true }, { type: 'FOLLOW_REQUESTED', channel: 'PUSH', enabled: true }]) } };
