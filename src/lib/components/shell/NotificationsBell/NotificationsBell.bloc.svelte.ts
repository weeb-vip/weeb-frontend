import { createMutation, createQuery, type CreateBaseMutationResult, type QueryClient, type QueryObserverResult } from '@tanstack/svelte-query';
import { derived, fromStore, writable, type Readable } from 'svelte/store';
import { loggedInStore } from '$lib/stores/auth';
import { fetchNotifications, fetchUnreadNotificationCount, markAllNotificationsRead } from '$lib/services/query-options';
import { defaultQueryClient } from '$lib/components/profile/MediaList.bloc.svelte';
import { actorOf, relativeTime, type ActivityActor } from '$lib/components/feed/activity';

/**
 * The bell in the header: an unread count that polls while you are signed in,
 * and a panel with the newest notifications when opened.
 *
 * No realtime anywhere in the stack yet, so the count is a poll; a minute is
 * cheap (one index-only scan) and quick enough for "someone followed you".
 */

export interface NotificationItem {
  id: string;
  type: string;
  actor: ActivityActor | null;
  text: string;
  href: string;
  isUnread: boolean;
  when: string;
  createdAt: string;
}

export interface NotificationsPort {
  unreadCount(): { queryKey: unknown[]; queryFn: () => Promise<number> };
  list(limit: number): { queryKey: unknown[]; queryFn: () => Promise<any> };
  markAllRead(): Promise<boolean>;
}

export const realNotificationsPort: NotificationsPort = {
  unreadCount: () => fetchUnreadNotificationCount(),
  list: (limit) => fetchNotifications(1, limit, false),
  markAllRead: () => markAllNotificationsRead().mutationFn(),
};

export interface NotificationsBellDeps {
  port?: NotificationsPort;
  auth?: Readable<{ isLoggedIn: boolean }>;
  queryClient?: QueryClient;
  pollMs?: number;
  limit?: number;
  now?: () => number;
}

/** What each notification says, from the viewer's side. */
export function describeNotification(notification: any): { text: string; href: string } {
  const actor = actorOf(notification?.actor);
  const profile = `/u/${encodeURIComponent(actor.username)}`;
  switch (notification?.type) {
    case 'FOLLOW_REQUESTED':
      return { text: `${actor.name} wants to follow you`, href: '/profile' };
    case 'FOLLOW_ACCEPTED':
      return { text: `${actor.name} accepted your follow request`, href: profile };
    case 'NEW_FOLLOWER':
      return { text: `${actor.name} started following you`, href: profile };
    default:
      return { text: 'Something happened', href: '/profile' };
  }
}

export class NotificationsBellBloc {
  readonly #auth: { readonly current: { isLoggedIn: boolean } };
  readonly #open = writable(false);
  readonly #count: { readonly current: QueryObserverResult<number, unknown> };
  readonly #list: { readonly current: QueryObserverResult<any, unknown> };
  readonly #markAll: { readonly current: CreateBaseMutationResult<boolean, unknown, void> };
  readonly #now: () => number;
  #isOpen = $state(false);

  constructor({
    port = realNotificationsPort,
    auth = loggedInStore,
    queryClient = defaultQueryClient(),
    pollMs = 60_000,
    limit = 10,
    now = () => Date.now(),
  }: NotificationsBellDeps = {}) {
    this.#auth = fromStore(auth);
    this.#now = now;

    this.#count = fromStore(
      createQuery(
        derived(auth, (state) => ({
          ...port.unreadCount(),
          enabled: state.isLoggedIn,
          refetchInterval: pollMs,
          refetchOnWindowFocus: true,
          retry: false,
          staleTime: pollMs / 2,
        })),
        queryClient,
      ),
    );

    // The list is only worth fetching while the panel is open.
    this.#list = fromStore(
      createQuery(
        derived([auth, this.#open], ([state, open]) => ({
          ...port.list(limit),
          enabled: state.isLoggedIn && open,
          staleTime: 0,
          retry: false,
        })),
        queryClient,
      ),
    );

    this.#markAll = fromStore(
      createMutation(
        {
          mutationFn: () => port.markAllRead(),
          onSuccess: () => {
            queryClient.setQueryData(port.unreadCount().queryKey, 0);
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
          },
        },
        queryClient,
      ),
    );
  }

  get isLoggedIn(): boolean {
    return this.#auth.current.isLoggedIn;
  }

  get isOpen(): boolean {
    return this.#isOpen;
  }

  get unreadCount(): number {
    return this.#count.current.data ?? 0;
  }

  /** "9+" past nine: the badge is a nudge, not a counter. */
  get badge(): string {
    const n = this.unreadCount;
    return n > 9 ? '9+' : String(n);
  }

  get hasUnread(): boolean {
    return this.unreadCount > 0;
  }

  get isListLoading(): boolean {
    return this.#isOpen && this.#list.current.isLoading;
  }

  get items(): NotificationItem[] {
    const rows: any[] = this.#list.current.data?.notifications ?? [];
    return rows.map((row) => {
      const { text, href } = describeNotification(row);
      return {
        id: row.id,
        type: row.type,
        actor: row.actor ? actorOf(row.actor) : null,
        text,
        href,
        isUnread: !row.readAt,
        when: relativeTime(row.createdAt ?? '', this.#now()),
        createdAt: row.createdAt ?? '',
      };
    });
  }

  get isMarking(): boolean {
    return this.#markAll.current.isPending;
  }

  toggle(): void {
    this.#isOpen = !this.#isOpen;
    this.#open.set(this.#isOpen);
  }

  close(): void {
    this.#isOpen = false;
    this.#open.set(false);
  }

  markAllRead(): void {
    if (!this.hasUnread || this.isMarking) return;
    this.#markAll.current.mutate();
  }
}
