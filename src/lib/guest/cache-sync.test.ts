import { beforeEach, describe, expect, it } from 'vitest';
import { writable } from 'svelte/store';
import { QueryClient } from '@tanstack/svelte-query';
import { createGuestList } from '$lib/stores/guestList';
import { startGuestCacheSync } from './cache-sync';

beforeEach(() => localStorage.clear());

describe('startGuestCacheSync', () => {
  it('rewrites cached queries as the browser list changes, once signed out', () => {
    const client = new QueryClient();
    const raw = { anime: { id: 'a1', userAnime: null } };
    client.setQueryData(['anime', 'a1'], raw);
    const auth = writable({ isLoggedIn: false, isAuthInitialized: false });
    const list = createGuestList();
    list.add('a1');
    const stop = startGuestCacheSync(client, auth, list);

    // Not before auth resolves: the server's answer stands until then.
    expect(client.getQueryData(['anime', 'a1'])).toBe(raw);

    auth.set({ isLoggedIn: false, isAuthInitialized: true });
    expect(client.getQueryData<typeof raw>(['anime', 'a1'])!.anime.userAnime).toMatchObject({ status: 'PLANTOWATCH' });

    list.setStatus('a1', 'COMPLETED');
    expect(client.getQueryData<typeof raw>(['anime', 'a1'])!.anime.userAnime).toMatchObject({ status: 'COMPLETED' });

    list.remove('a1');
    expect(client.getQueryData<typeof raw>(['anime', 'a1'])!.anime.userAnime).toBeNull();
    stop();
  });

  it('leaves a member’s cache alone', () => {
    const client = new QueryClient();
    const raw = { anime: { id: 'a1', userAnime: null } };
    client.setQueryData(['anime', 'a1'], raw);
    const list = createGuestList();
    list.add('a1');
    const stop = startGuestCacheSync(client, writable({ isLoggedIn: true, isAuthInitialized: true }), list);

    expect(client.getQueryData(['anime', 'a1'])).toBe(raw);
    stop();
  });
});
