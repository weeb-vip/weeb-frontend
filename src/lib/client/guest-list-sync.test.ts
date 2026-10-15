import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writable } from 'svelte/store';
import { createGuestList } from '$lib/stores/guestList';
import { startGuestListSync } from './guest-list-sync';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => localStorage.clear());

describe('startGuestListSync', () => {
  it('uploads the browser list on sign-in and clears it', async () => {
    const auth = writable({ isLoggedIn: false });
    const guestList = createGuestList();
    guestList.add('a1');
    guestList.add('a2');
    guestList.setStatus('a2', 'WATCHING');
    const save = vi.fn().mockResolvedValue({});
    const onSynced = vi.fn();
    const stop = startGuestListSync({ auth, guestList, save, onSynced });

    auth.set({ isLoggedIn: true });
    await flush();
    await flush();

    expect(save).toHaveBeenCalledWith({ animeID: 'a1', status: 'PLANTOWATCH' });
    expect(save).toHaveBeenCalledWith({ animeID: 'a2', status: 'WATCHING' });
    expect(guestList.entries()).toEqual([]);
    expect(onSynced).toHaveBeenCalledWith(2, 2);
    stop();
  });

  it('keeps what failed for the next sign-in', async () => {
    const auth = writable({ isLoggedIn: false });
    const guestList = createGuestList();
    guestList.add('a1');
    guestList.add('a2');
    const save = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('nope'));
    const onSynced = vi.fn();
    const stop = startGuestListSync({ auth, guestList, save, onSynced });

    auth.set({ isLoggedIn: true });
    await flush();
    await flush();

    expect(guestList.entries().map((e) => e.animeID)).toEqual(['a2']);
    expect(onSynced).toHaveBeenCalledWith(1, 2);
    stop();
  });

  it('does nothing with an empty list, or while signed out', async () => {
    const auth = writable({ isLoggedIn: false });
    const save = vi.fn();
    const onSynced = vi.fn();
    const stop = startGuestListSync({ auth, guestList: createGuestList(), save, onSynced });

    auth.set({ isLoggedIn: true });
    await flush();

    expect(save).not.toHaveBeenCalled();
    expect(onSynced).not.toHaveBeenCalled();
    stop();
  });
});
