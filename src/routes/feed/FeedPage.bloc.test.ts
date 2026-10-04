import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { writable } from 'svelte/store';
import { reactiveScope } from '$lib/components/__tests__/reactive-scope.svelte';
import { FeedPageBloc, type FeedPort } from './FeedPage.bloc.svelte';

const NOW = Date.parse('2026-10-03T12:00:00Z');

function row(id: string, actor = 'bob') {
  return {
    id, type: 'ANIME_ADDED', status: 'WATCHING', occurredAt: '2026-10-03T11:00:00Z',
    actor: { id: `user_${actor}`, username: actor },
    anime: { id: `anime-${id}`, slug: `slug-${id}`, titleEn: `Title ${id}` },
  };
}

function pageOf(ids: string[], total: number, page = 1) {
  return { page, limit: 2, total, activities: ids.map((id) => row(id)) };
}

function makeBloc(opts: { ssr?: any; loggedIn?: boolean; port?: FeedPort } = {}) {
  const auth = writable({ isLoggedIn: opts.loggedIn ?? true });
  const port: FeedPort = opts.port ?? { page: vi.fn((page: number) => ({ queryKey: ['feed', page], queryFn: async () => pageOf([`p${page}a`, `p${page}b`], 5, page) })) };
  const bloc = new FeedPageBloc({
    source: () => ({ ssr: opts.ssr ?? null }),
    port,
    auth,
    pageSize: 2,
    now: () => NOW,
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  });
  return { bloc, auth, port };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
const scopes: (() => void)[] = [];
afterEach(() => { scopes.splice(0).forEach((stop) => stop()); });

describe('FeedPageBloc', () => {
  it('renders the server page without fetching again', async () => {
    const port: FeedPort = { page: vi.fn(() => ({ queryKey: ['feed', 1], queryFn: vi.fn(async () => { throw new Error('should not fetch'); }) })) };
    const { bloc } = makeBloc({ ssr: { feed: pageOf(['a', 'b'], 5) }, port });
    scopes.push(reactiveScope(() => bloc.items));
    await settle();

    expect(bloc.isLoading).toBe(false);
    expect(bloc.items.map((i) => i.key)).toEqual(['a', 'b']);
    expect(bloc.items[0].actor.username).toBe('bob');
    expect(bloc.items[0].verb).toBe('started watching');
    expect(bloc.items[0].when).toBe('1h');
    expect(bloc.total).toBe(5);
    expect(bloc.totalPages).toBe(3);
    expect(bloc.hasNext).toBe(true);
    expect(bloc.hasPrevious).toBe(false);
  });

  it('pages with the client query and clamps at the ends', async () => {
    const { bloc, port } = makeBloc();
    scopes.push(reactiveScope(() => bloc.items));
    await vi.waitFor(() => expect(bloc.items.map((i) => i.key)).toEqual(['p1a', 'p1b']));

    bloc.next();
    expect(bloc.page).toBe(2);
    await vi.waitFor(() => expect(bloc.items.map((i) => i.key)).toEqual(['p2a', 'p2b']));
    expect(port.page).toHaveBeenLastCalledWith(2, 2);

    bloc.goTo(99);
    expect(bloc.page).toBe(3);
    await vi.waitFor(() => expect(bloc.hasNext).toBe(false));

    bloc.previous();
    bloc.previous();
    bloc.previous();
    expect(bloc.page).toBe(1);
  });

  it('does nothing for a signed-out visitor', async () => {
    const port: FeedPort = { page: vi.fn(() => ({ queryKey: ['feed', 1], queryFn: vi.fn(async () => pageOf(['a'], 1)) })) };
    const { bloc } = makeBloc({ loggedIn: false, port });
    scopes.push(reactiveScope(() => bloc.items));
    await settle();

    expect(bloc.isLoggedIn).toBe(false);
    expect(bloc.isLoading).toBe(false);
    expect(bloc.isEmpty).toBe(false);
    expect(bloc.items).toEqual([]);
  });

  it('knows an empty feed from a loading one', async () => {
    const port: FeedPort = { page: () => ({ queryKey: ['feed', 1], queryFn: async () => pageOf([], 0) }) };
    const { bloc } = makeBloc({ port });
    scopes.push(reactiveScope(() => bloc.items, () => bloc.isLoading));
    await settle();

    expect(bloc.isEmpty).toBe(true);
    expect(bloc.totalPages).toBe(1);
  });
});

describe("the server's answer, before the client store has resolved", () => {
  it('renders the feed the loader already fetched instead of "Sign in"', async () => {
    const bloc = new FeedPageBloc({
      source: () => ({ ssr: { feed: pageOf(['a', 'b'], 2) } }),
      port: { page: vi.fn(() => ({ queryKey: ['feed', 1], queryFn: async () => { throw new Error('should not fetch on the server'); } })) },
      auth: writable({ isLoggedIn: false, isAuthInitialized: false }),
      serverAuth: { isLoggedIn: true },
      pageSize: 2,
      now: () => NOW,
      queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    });
    scopes.push(reactiveScope(() => bloc.items));
    await settle();

    expect(bloc.isLoggedIn).toBe(true);
    expect(bloc.isLoading).toBe(false);
    expect(bloc.items.map((i) => i.key)).toEqual(['a', 'b']);
  });

  it('says signed out when the server did, and when the resolved store does', () => {
    const make = (auth: any, serverAuth: any) => new FeedPageBloc({
      port: { page: vi.fn(() => ({ queryKey: ['feed', 1], queryFn: async () => pageOf([], 0) })) },
      auth, serverAuth, pageSize: 2, now: () => NOW,
      queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    });
    expect(make(writable({ isLoggedIn: false, isAuthInitialized: false }), { isLoggedIn: false }).isLoggedIn).toBe(false);
    expect(make(writable({ isLoggedIn: false, isAuthInitialized: true }), { isLoggedIn: true }).isLoggedIn).toBe(false);
  });
});
