import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writable } from 'svelte/store';
import { createGuestList } from '$lib/stores/guestList';
import { startGuestListSync, SYNC_CHUNK } from './guest-list-sync';

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeEach(() => localStorage.clear());

describe('startGuestListSync', () => {
  it('uploads the browser list in one batch on sign-in and clears it', async () => {
    const auth = writable({ isLoggedIn: false });
    const guestList = createGuestList();
    guestList.add('a1');
    guestList.add('a2');
    guestList.setStatus('a2', 'WATCHING');
    const saveBatch = vi.fn().mockResolvedValue({ added: 2, skipped: 0 });
    const onSynced = vi.fn();
    const stop = startGuestListSync({ auth, guestList, saveBatch, onSynced });

    auth.set({ isLoggedIn: true });
    await flush();

    expect(saveBatch).toHaveBeenCalledTimes(1);
    expect(saveBatch).toHaveBeenCalledWith([
      { animeID: 'a1', status: 'PLANTOWATCH' },
      { animeID: 'a2', status: 'WATCHING' }
    ]);
    expect(guestList.entries()).toEqual([]);
    expect(onSynced).toHaveBeenCalledWith(2, 2);
    stop();
  });

  it('sends a big list in chunks the server accepts', async () => {
    const auth = writable({ isLoggedIn: false });
    const guestList = createGuestList();
    for (let i = 0; i < 1000; i++) guestList.add(`a${i}`);
    const saveBatch = vi.fn().mockResolvedValue({});
    const stop = startGuestListSync({ auth, guestList, saveBatch });

    auth.set({ isLoggedIn: true });
    await flush();

    expect(saveBatch).toHaveBeenCalledTimes(1000 / SYNC_CHUNK);
    for (const [inputs] of saveBatch.mock.calls) expect(inputs.length).toBeLessThanOrEqual(SYNC_CHUNK);
    expect(guestList.entries()).toEqual([]);
    stop();
  });

  it('keeps a failed chunk for the next sign-in', async () => {
    const auth = writable({ isLoggedIn: false });
    const guestList = createGuestList();
    for (let i = 0; i < SYNC_CHUNK + 1; i++) guestList.add(`a${i}`);
    const saveBatch = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('nope'));
    const onSynced = vi.fn();
    const stop = startGuestListSync({ auth, guestList, saveBatch, onSynced });

    auth.set({ isLoggedIn: true });
    await flush();

    expect(guestList.entries().map((e) => e.animeID)).toEqual([`a${SYNC_CHUNK}`]);
    expect(onSynced).toHaveBeenCalledWith(SYNC_CHUNK, SYNC_CHUNK + 1);
    stop();
  });

  it('does nothing with an empty list', async () => {
    const auth = writable({ isLoggedIn: false });
    const saveBatch = vi.fn();
    const onSynced = vi.fn();
    const stop = startGuestListSync({ auth, guestList: createGuestList(), saveBatch, onSynced });

    auth.set({ isLoggedIn: true });
    await flush();

    expect(saveBatch).not.toHaveBeenCalled();
    expect(onSynced).not.toHaveBeenCalled();
    stop();
  });
});
