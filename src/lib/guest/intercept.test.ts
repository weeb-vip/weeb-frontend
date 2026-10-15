import { describe, expect, it, vi } from 'vitest';
import { withGuestOverlay } from './intercept';

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, ...init });

const BODY = { data: { currentlyAiring: [{ id: 'a1', userAnime: null }, { id: 'a2', userAnime: null }] } };
const ENTRIES = { a1: { animeID: 'a1', status: 'WATCHING', addedAt: 1 } };

describe('withGuestOverlay', () => {
  it('puts the browser list into a guest’s response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(BODY));
    const res = await withGuestOverlay(fetchFn, () => ENTRIES)('/graphql');
    const body = await res.json();

    expect(body.data.currentlyAiring[0].userAnime).toMatchObject({ status: 'WATCHING' });
    expect(body.data.currentlyAiring[1].userAnime).toBeNull();
  });

  it('passes members, pre-auth requests and errors straight through', async () => {
    const original = json(BODY);
    expect(await withGuestOverlay(async () => original, () => null)('/graphql')).toBe(original);

    const failed = json(BODY, { status: 500 });
    expect(await withGuestOverlay(async () => failed, () => ENTRIES)('/graphql')).toBe(failed);
  });

  it('returns the response as it came when there is nothing to change', async () => {
    const original = json({ data: { me: { id: 'u1' } } });
    expect(await withGuestOverlay(async () => original, () => ENTRIES)('/graphql')).toBe(original);
  });
});
