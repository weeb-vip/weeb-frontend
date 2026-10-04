import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { writable } from 'svelte/store';
import { reactiveScope } from '$lib/components/__tests__/reactive-scope.svelte';
import { FollowRequestsBloc, type FollowRequestsPort } from './FollowRequests.bloc.svelte';

const USERS = [
  { id: 'user_alice', username: 'alice', firstname: 'Alice', lastname: '' },
  { id: 'user_carol', username: 'carol' },
];

function makePort(overrides: Partial<FollowRequestsPort> = {}) {
  return {
    list: vi.fn((limit: number) => ({ queryKey: ['follow-requests', 1, limit], queryFn: async () => ({ total: 2, users: USERS }) })),
    accept: vi.fn(async () => true),
    decline: vi.fn(async () => true),
    ...overrides,
  } as FollowRequestsPort & { accept: ReturnType<typeof vi.fn>; decline: ReturnType<typeof vi.fn> };
}

function makeBloc(port = makePort(), loggedIn = true) {
  const notify = { error: vi.fn() };
  const bloc = new FollowRequestsBloc({
    port, auth: writable({ isLoggedIn: loggedIn }), notify,
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
  });
  return { bloc, port, notify };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
const scopes: (() => void)[] = [];
afterEach(() => { scopes.splice(0).forEach((stop) => stop()); });

describe('FollowRequestsBloc', () => {
  it('lists pending requests with display names', async () => {
    const { bloc } = makeBloc();
    scopes.push(reactiveScope(() => bloc.requests));
    await settle();
    expect(bloc.hasRequests).toBe(true);
    expect(bloc.total).toBe(2);
    expect(bloc.requests.map((r) => r.name)).toEqual(['Alice', 'carol']);
  });

  it('hides an answered request straight away', async () => {
    const { bloc, port } = makeBloc();
    scopes.push(reactiveScope(() => bloc.requests, () => bloc.isBusy('user_alice')));
    await settle();

    bloc.accept('user_alice');
    await settle();
    expect(port.accept).toHaveBeenCalledWith('user_alice');
    expect(bloc.requests.map((r) => r.id)).toEqual(['user_carol']);
    expect(bloc.total).toBe(1);

    bloc.decline('user_carol');
    await settle();
    expect(port.decline).toHaveBeenCalledWith('user_carol');
    expect(bloc.hasRequests).toBe(false);
  });

  it('keeps the request and tells the viewer when the answer fails', async () => {
    const port = makePort({ accept: vi.fn(async () => { throw { response: { errors: [{ extensions: { message: 'Gone' } }] } }; }) });
    const { bloc, notify } = makeBloc(port);
    scopes.push(reactiveScope(() => bloc.requests, () => bloc.isBusy('user_alice')));
    await settle();

    bloc.accept('user_alice');
    await settle();
    expect(notify.error).toHaveBeenCalledWith('Gone');
    expect(bloc.requests).toHaveLength(2);
  });

  it('fetches nothing when signed out', async () => {
    const port = makePort();
    const { bloc } = makeBloc(port, false);
    scopes.push(reactiveScope(() => bloc.requests));
    await settle();
    expect(bloc.hasRequests).toBe(false);
  });
});

describe("the server's answer, before the client store has resolved", () => {
  it('is believed until the store resolves, then the store wins', () => {
    const client = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    expect(new FollowRequestsBloc({ port: makePort(), auth: writable({ isLoggedIn: false, isAuthInitialized: false }), serverAuth: { isLoggedIn: true }, notify: { error: vi.fn() }, queryClient: client() }).isLoggedIn).toBe(true);
    expect(new FollowRequestsBloc({ port: makePort(), auth: writable({ isLoggedIn: false, isAuthInitialized: true }), serverAuth: { isLoggedIn: true }, notify: { error: vi.fn() }, queryClient: client() }).isLoggedIn).toBe(false);
  });
});
