import { describe, expect, it } from 'vitest';
import { overlayGuestList } from './overlay';

const entry = (animeID: string, status = 'PLANTOWATCH') => ({ animeID, status, addedAt: 1 });

describe('overlayGuestList', () => {
  it('gives a saved show a stand-in userAnime, wherever it sits', () => {
    const data = {
      currentlyAiring: [
        { id: 'a1', titleEn: 'One', userAnime: null },
        { id: 'a2', titleEn: 'Two', userAnime: null }
      ],
      nested: { anime: { id: 'a1', userAnime: null } }
    };

    const out = overlayGuestList(data, { a1: entry('a1', 'WATCHING') });

    expect(out.currentlyAiring[0].userAnime).toMatchObject({ id: 'guest:a1', status: 'WATCHING' });
    expect(out.nested.anime.userAnime).toMatchObject({ status: 'WATCHING' });
    expect(out.currentlyAiring[1]).toBe(data.currentlyAiring[1]);
    expect(data.currentlyAiring[0].userAnime).toBeNull();
  });

  it('returns the same object when there is nothing to change', () => {
    const data = { list: [{ id: 'a1', userAnime: null }], other: { id: 'x' } };
    expect(overlayGuestList(data, {})).toBe(data);

    const once = overlayGuestList(data, { a1: entry('a1') });
    expect(overlayGuestList(once, { a1: entry('a1') })).toBe(once);
  });

  it('follows a status change and a removal', () => {
    const once = overlayGuestList({ a: { id: 'a1', userAnime: null } }, { a1: entry('a1') });
    const changed = overlayGuestList(once, { a1: entry('a1', 'COMPLETED') });
    expect(changed.a.userAnime).toMatchObject({ status: 'COMPLETED' });

    const removed = overlayGuestList(changed, {});
    expect(removed.a.userAnime).toBeNull();
  });

  it('never touches a real userAnime from the server', () => {
    const data = { a: { id: 'a1', userAnime: { id: 'ua-9', status: 'COMPLETED' } } };
    expect(overlayGuestList(data, { a1: entry('a1') })).toBe(data);
    expect(overlayGuestList(data, {})).toBe(data);
  });

  it('only touches objects that asked for userAnime', () => {
    const data = { anime: { id: 'a1', titleEn: 'No list field' } };
    expect(overlayGuestList(data, { a1: entry('a1') })).toBe(data);
  });

  it('passes through primitives, null and class instances', () => {
    const date = new Date();
    expect(overlayGuestList(null, {})).toBeNull();
    expect(overlayGuestList('x', {})).toBe('x');
    expect(overlayGuestList({ d: date }, {}).d).toBe(date);
  });
});
