import { createMutation, createQuery, type CreateBaseMutationResult, type QueryClient, type QueryObserverResult } from '@tanstack/svelte-query';
import { derived, fromStore, type Readable } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { loggedInStore } from '$lib/stores/auth';
import { fetchNotificationPreferences, updateNotificationPreference } from '$lib/services/query-options';
import { defaultQueryClient } from '$lib/components/profile/MediaList.bloc.svelte';

/**
 * The type x channel matrix on the settings page. Each switch saves on its
 * own: a preference is one row and there is nothing to batch.
 */

export const NOTIFICATION_TYPES = [
  { type: 'FOLLOW_REQUESTED', label: 'Follow requests', detail: 'Someone asks to follow you.' },
  { type: 'FOLLOW_ACCEPTED', label: 'Accepted requests', detail: 'Someone approves your follow request.' },
  { type: 'NEW_FOLLOWER', label: 'New followers', detail: 'Someone starts following you.' },
] as const;

export const NOTIFICATION_CHANNELS = [
  { channel: 'IN_APP', label: 'In app' },
  { channel: 'PUSH', label: 'Push' },
  { channel: 'EMAIL', label: 'Email' },
] as const;

export interface PreferenceInput {
  type: string;
  channel: string;
  enabled: boolean;
}

export interface NotificationPreferencesPort {
  list(): { queryKey: unknown[]; queryFn: () => Promise<any> };
  update(input: PreferenceInput): Promise<any>;
}

export const realNotificationPreferencesPort: NotificationPreferencesPort = {
  list: () => fetchNotificationPreferences(),
  update: (input) => updateNotificationPreference().mutationFn(input),
};

export interface NotificationPreferencesDeps {
  port?: NotificationPreferencesPort;
  auth?: Readable<{ isLoggedIn: boolean }>;
  queryClient?: QueryClient;
  notify?: { error(message: string): void };
}

const key = (type: string, channel: string) => `${type}/${channel}`;

export class NotificationPreferencesBloc {
  readonly types = NOTIFICATION_TYPES;
  readonly channels = NOTIFICATION_CHANNELS;
  readonly #query: { readonly current: QueryObserverResult<any, unknown> };
  readonly #update: { readonly current: CreateBaseMutationResult<any, unknown, PreferenceInput> };
  /** What the viewer flipped, shown at once and confirmed or rolled back. */
  #overrides = $state<Record<string, boolean>>({});
  #saving = $state<Record<string, true>>({});

  constructor({
    port = realNotificationPreferencesPort,
    auth = loggedInStore,
    queryClient = defaultQueryClient(),
    notify = { error: (message) => toast.error(message) },
  }: NotificationPreferencesDeps = {}) {
    this.#query = fromStore(
      createQuery(derived(auth, (state) => ({ ...port.list(), enabled: state.isLoggedIn, staleTime: 60_000 })), queryClient),
    );

    this.#update = fromStore(
      createMutation(
        {
          mutationFn: (input: PreferenceInput) => port.update(input),
          onError: (error: any, input: PreferenceInput) => {
            const k = key(input.type, input.channel);
            const { [k]: _, ...rest } = this.#overrides;
            this.#overrides = rest;
            const gql = error?.response?.errors?.[0];
            notify.error(gql?.extensions?.message || gql?.message || 'Could not save that preference.');
          },
          onSettled: (_data: any, _error: any, input: PreferenceInput) => {
            const k = key(input.type, input.channel);
            const { [k]: _, ...rest } = this.#saving;
            this.#saving = rest;
            queryClient.invalidateQueries({ queryKey: port.list().queryKey });
          },
        },
        queryClient,
      ),
    );
  }

  get isLoading(): boolean {
    return this.#query.current.isLoading;
  }

  get isReady(): boolean {
    return !!this.#query.current.data;
  }

  isEnabled(type: string, channel: string): boolean {
    const k = key(type, channel);
    if (k in this.#overrides) return this.#overrides[k];
    const rows: any[] = this.#query.current.data ?? [];
    const row = rows.find((r) => r.type === type && r.channel === channel);
    return row ? !!row.enabled : channel === 'IN_APP';
  }

  isSaving(type: string, channel: string): boolean {
    return !!this.#saving[key(type, channel)];
  }

  toggle(type: string, channel: string): void {
    if (this.isSaving(type, channel) || !this.isReady) return;
    const enabled = !this.isEnabled(type, channel);
    // Flip here, synchronously, rather than in onMutate: the switch should
    // move under the finger, not a tick later.
    const k = key(type, channel);
    this.#overrides = { ...this.#overrides, [k]: enabled };
    this.#saving = { ...this.#saving, [k]: true };
    this.#update.current.mutate({ type, channel, enabled });
  }
}
