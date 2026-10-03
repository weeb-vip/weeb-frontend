import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { writable } from 'svelte/store';
import { reactiveScope } from '$lib/components/__tests__/reactive-scope.svelte';
import { NotificationPreferencesBloc, type NotificationPreferencesPort } from './NotificationPreferences.bloc.svelte';

const ROWS = [
  { type: 'FOLLOW_REQUESTED', channel: 'IN_APP', enabled: true },
  { type: 'FOLLOW_REQUESTED', channel: 'PUSH', enabled: false },
  { type: 'FOLLOW_REQUESTED', channel: 'EMAIL', enabled: true },
];

function makePort(update = vi.fn(async (input: any) => input)) {
  return {
    list: vi.fn(() => ({ queryKey: ['notification-preferences'], queryFn: async () => ROWS })),
    update,
  } as NotificationPreferencesPort & { update: typeof update };
}

function makeBloc(port = makePort()) {
  const notify = { error: vi.fn() };
  const bloc = new NotificationPreferencesBloc({
    port, auth: writable({ isLoggedIn: true }), notify,
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
  });
  return { bloc, port, notify };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
const scopes: (() => void)[] = [];
afterEach(() => { scopes.splice(0).forEach((stop) => stop()); });

describe('NotificationPreferencesBloc', () => {
  it('reads stored rows and defaults the rest to in-app only', async () => {
    const { bloc } = makeBloc();
    scopes.push(reactiveScope(() => bloc.isReady));
    await settle();
    expect(bloc.isEnabled('FOLLOW_REQUESTED', 'EMAIL')).toBe(true);
    expect(bloc.isEnabled('FOLLOW_REQUESTED', 'PUSH')).toBe(false);
    expect(bloc.isEnabled('NEW_FOLLOWER', 'IN_APP')).toBe(true);
    expect(bloc.isEnabled('NEW_FOLLOWER', 'EMAIL')).toBe(false);
  });

  it('flips at once and saves the flipped value', async () => {
    const { bloc, port } = makeBloc();
    scopes.push(reactiveScope(() => bloc.isReady, () => bloc.isSaving('NEW_FOLLOWER', 'PUSH')));
    await settle();

    bloc.toggle('NEW_FOLLOWER', 'PUSH');
    expect(bloc.isEnabled('NEW_FOLLOWER', 'PUSH')).toBe(true);
    await settle();
    expect(port.update).toHaveBeenCalledWith({ type: 'NEW_FOLLOWER', channel: 'PUSH', enabled: true });
    expect(bloc.isSaving('NEW_FOLLOWER', 'PUSH')).toBe(false);
  });

  it('rolls back and tells the viewer when the save fails', async () => {
    const port = makePort(vi.fn(async (_input: any) => { throw new Error('nope'); }));
    const { bloc, notify } = makeBloc(port);
    scopes.push(reactiveScope(() => bloc.isReady, () => bloc.isSaving('NEW_FOLLOWER', 'EMAIL')));
    await settle();

    bloc.toggle('NEW_FOLLOWER', 'EMAIL');
    expect(bloc.isEnabled('NEW_FOLLOWER', 'EMAIL')).toBe(true);
    await settle();
    expect(bloc.isEnabled('NEW_FOLLOWER', 'EMAIL')).toBe(false);
    expect(notify.error).toHaveBeenCalled();
  });
});
