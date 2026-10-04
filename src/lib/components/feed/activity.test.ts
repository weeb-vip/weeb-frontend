import { describe, it, expect } from 'vitest';
import { describeActivity, relativeTime, toActivityItems } from './activity';

describe('describeActivity', () => {
  it('names the move for anime', () => {
    expect(describeActivity({ type: 'ANIME_ADDED', status: 'PLANTOWATCH' })).toBe('plans to watch');
    expect(describeActivity({ type: 'ANIME_ADDED', status: 'WATCHING' })).toBe('started watching');
    expect(describeActivity({ type: 'ANIME_STATUS_CHANGED', status: 'COMPLETED' })).toBe('finished watching');
    expect(describeActivity({ type: 'ANIME_STATUS_CHANGED', status: 'DROPPED' })).toBe('dropped');
  });

  it('names the move for works', () => {
    expect(describeActivity({ type: 'WORK_ADDED', status: 'READING' })).toBe('started reading');
    expect(describeActivity({ type: 'WORK_STATUS_CHANGED', status: 'COMPLETED' })).toBe('finished reading');
  });

  it('formats scores without a trailing .0', () => {
    expect(describeActivity({ type: 'ANIME_SCORED', score: 8 })).toBe('scored 8');
    expect(describeActivity({ type: 'WORK_SCORED', score: 8.5 })).toBe('scored 8.5');
    expect(describeActivity({ type: 'ANIME_SCORED' })).toBe('rated');
  });

  it('falls back for anything unknown', () => {
    expect(describeActivity({ type: 'SOMETHING_NEW' })).toBe('updated');
    expect(describeActivity({ type: 'ANIME_STATUS_CHANGED', status: 'weird' })).toBe('updated');
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-10-03T12:00:00Z');
  it('rounds to the largest unit that fits', () => {
    expect(relativeTime('2026-10-03T11:59:40Z', now)).toBe('just now');
    expect(relativeTime('2026-10-03T11:55:00Z', now)).toBe('5m');
    expect(relativeTime('2026-10-03T09:00:00Z', now)).toBe('3h');
    expect(relativeTime('2026-10-01T12:00:00Z', now)).toBe('2d');
  });
  it('shows a date once it is more than a week old', () => {
    expect(relativeTime('2026-09-01T12:00:00Z', now)).toMatch(/Sep/);
  });
  it('is empty for garbage', () => {
    expect(relativeTime('nope', now)).toBe('');
  });
});

describe('toActivityItems', () => {
  const now = Date.parse('2026-10-03T12:00:00Z');
  const rows = [
    {
      id: 'a1', type: 'ANIME_STATUS_CHANGED', status: 'COMPLETED', occurredAt: '2026-10-03T11:00:00Z',
      actor: { id: 'user_bob', username: 'bob', firstname: 'Bob', lastname: 'B', profileImageUrl: 'p.jpg' },
      anime: { id: 'anime-1', slug: 'cowboy-bebop', titleEn: 'Cowboy Bebop', titleJp: 'カウボーイビバップ' },
    },
    {
      id: 'a2', type: 'WORK_ADDED', status: 'READING', occurredAt: '2026-10-03T10:00:00Z',
      actor: { id: 'user_alice', username: 'alice' },
      work: { id: 'work-1', urlSlug: 'berserk', titleEn: '', titleJp: 'ベルセルク', type: 'MANGA' },
    },
    { id: 'a3', type: 'ANIME_ADDED', actor: { id: 'x', username: 'x' } },
  ];

  it('maps anime rows to poster cards with the actor sentence', () => {
    const items = toActivityItems(rows, now);
    expect(items).toHaveLength(2);
    const [first, second] = items;
    expect(first.key).toBe('a1');
    expect(first.actor).toEqual({ id: 'user_bob', username: 'bob', name: 'Bob B', profileImageUrl: 'p.jpg' });
    expect(first.verb).toBe('finished watching');
    expect(first.card).toEqual({ id: 'anime-1', slug: 'cowboy-bebop', title: 'Cowboy Bebop', image: 'anime-1', imagePath: 'posters', onList: 'COMPLETED' });
    expect(first.when).toBe('1h');

    expect(second.actor.name).toBe('alice');
    expect(second.card.imagePath).toBe('works');
    expect(second.card.href).toBe('/manga/berserk');
    expect(second.card.title).toBe('ベルセルク');
  });

  it('skips rows with no title to show', () => {
    expect(toActivityItems(rows, now).map((i) => i.key)).not.toContain('a3');
  });

  it('tolerates nothing', () => {
    expect(toActivityItems(null)).toEqual([]);
  });
});
