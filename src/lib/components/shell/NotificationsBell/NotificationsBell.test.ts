import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { writable } from 'svelte/store';
import { reactiveScope } from '$lib/components/__tests__/reactive-scope.svelte';
import { NotificationsBellBloc, describeNotification, type NotificationsPort } from './NotificationsBell.bloc.svelte';

const NOW = Date.parse('2026-10-03T12:00:00Z');

function makePort(count = 2, rows: any[] = [
  { id: 'n1', type: 'NEW_FOLLOWER', readAt: null, createdAt: '2026-10-03T11:30:00Z', actor: { id: 'user_bob', username: 'bob', firstname: 'Bob' } },
  { id: 'n2', type: 'FOLLOW_ACCEPTED', readAt: '2026-10-03T10:00:00Z', createdAt: '2026-10-02T12:00:00Z', actor: { id: 'user_ann', username: 'ann' } },
]) {
  const port = {
    unreadCount: vi.fn(() => ({ queryKey: ['unread-notification-count'], queryFn: vi.fn(async () => count) })),
    list: vi.fn((limit: number) => ({ queryKey: ['notifications', 1, limit, false], queryFn: vi.fn(async () => ({ total: rows.length, notifications: rows })) })),
    markAllRead: vi.fn(async () => true),
  };
  return port as NotificationsPort & typeof port;
}

function makeBloc(port = makePort(), loggedIn = true) {
  const auth = writable({ isLoggedIn: loggedIn });
  const bloc = new NotificationsBellBloc({
    port, auth, pollMs: 100_000, limit: 10, now: () => NOW,
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
  });
  return { bloc, auth, port };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
const scopes: (() => void)[] = [];
afterEach(() => { scopes.splice(0).forEach((stop) => stop()); });

describe('describeNotification', () => {
  it('speaks from the viewer\'s side', () => {
    expect(describeNotification({ type: 'FOLLOW_REQUESTED', actor: { username: 'bob' } })).toEqual({ text: 'bob wants to follow you', href: '/profile' });
    expect(describeNotification({ type: 'FOLLOW_ACCEPTED', actor: { username: 'bob', firstname: 'Bob', lastname: 'B' } })).toEqual({ text: 'Bob B accepted your follow request', href: '/u/bob' });
    expect(describeNotification({ type: 'NEW_FOLLOWER', actor: { username: 'bob' } }).text).toBe('bob started following you');
    expect(describeNotification({ type: 'OTHER' }).text).toBe('Something happened');
  });
});

describe('NotificationsBellBloc', () => {
  it('polls the unread count while signed in and shows a badge', async () => {
    const { bloc } = makeBloc();
    scopes.push(reactiveScope(() => bloc.unreadCount));
    await settle();
    expect(bloc.isLoggedIn).toBe(true);
    expect(bloc.unreadCount).toBe(2);
    expect(bloc.hasUnread).toBe(true);
    expect(bloc.badge).toBe('2');
  });

  it('caps the badge at 9+', async () => {
    const { bloc } = makeBloc(makePort(42));
    scopes.push(reactiveScope(() => bloc.unreadCount));
    await settle();
    expect(bloc.badge).toBe('9+');
  });

  it('fetches nothing for a signed-out visitor', async () => {
    const port = makePort();
    const { bloc } = makeBloc(port, false);
    scopes.push(reactiveScope(() => bloc.unreadCount));
    await settle();
    expect(bloc.isLoggedIn).toBe(false);
    expect(bloc.unreadCount).toBe(0);
    expect(port.unreadCount.mock.results[0].value.queryFn).not.toHaveBeenCalled();
  });

  it('loads the list only when opened, and maps it', async () => {
    const port = makePort();
    const { bloc } = makeBloc(port);
    scopes.push(reactiveScope(() => bloc.items, () => bloc.isOpen));
    await settle();
    expect(port.list.mock.results[0].value.queryFn).not.toHaveBeenCalled();

    bloc.toggle();
    await settle();
    expect(bloc.isOpen).toBe(true);
    expect(bloc.items).toHaveLength(2);
    expect(bloc.items[0]).toMatchObject({ id: 'n1', text: 'Bob started following you', href: '/u/bob', isUnread: true, when: '30m' });
    expect(bloc.items[1]).toMatchObject({ id: 'n2', isUnread: false, when: '1d' });

    bloc.close();
    expect(bloc.isOpen).toBe(false);
  });

  it('marks everything read and zeroes the badge', async () => {
    const port = makePort();
    const { bloc } = makeBloc(port);
    scopes.push(reactiveScope(() => bloc.unreadCount, () => bloc.isMarking));
    await settle();
    expect(bloc.hasUnread).toBe(true);

    bloc.markAllRead();
    await settle();
    expect(port.markAllRead).toHaveBeenCalledTimes(1);
    expect(bloc.unreadCount).toBe(0);

    bloc.markAllRead();
    expect(port.markAllRead).toHaveBeenCalledTimes(1);
  });
});
