import { describe, it, expect } from 'vitest';
import { RAIL_LIMIT, railRows, rowMeta, whenLabel } from './HeroAiringRail.logic';

/**
 * The rail's short "when" form. It deliberately does not print `timing.label`:
 * that string is already on the line below, and its width made the title column
 * ellipsise at a different place depending on how far away a show airs.
 */

const NOW = Date.parse('2024-03-01T00:00:00Z');

describe('whenLabel', () => {
  it('says nothing without timing', () => {
    expect(whenLabel(null)).toBe('');
    expect(whenLabel(undefined)).toBe('');
  });

  it('says "Now" for a show that is on the air', () => {
    expect(whenLabel({ isLive: true, countdown: 'AIRING NOW' })).toBe('Now');
  });

  it('keeps a live countdown that says something more specific', () => {
    expect(whenLabel({ isLive: true, countdown: '12m left' })).toBe('12m left');
  });

  it('says "Aired" for a show already past', () => {
    expect(whenLabel({ hasAired: true, countdown: '3h' })).toBe('Aired');
  });

  it('uses the shared countdown inside a day', () => {
    expect(whenLabel({ countdown: '45m' })).toBe('in 45m');
    expect(whenLabel({ countdown: '15h' })).toBe('in 15h');
  });

  it('counts whole days beyond that, rather than repeating the exact time', () => {
    expect(whenLabel({ airDateTime: '2024-03-04T00:00:00Z' }, NOW)).toBe('in 3d');
  });

  it('rounds a part-day up, and never counts down to zero days', () => {
    expect(whenLabel({ airDateTime: '2024-03-03T12:00:00Z' }, NOW)).toBe('in 3d');
    expect(whenLabel({ airDateTime: '2024-03-01T01:00:00Z' }, NOW)).toBe('in 1d');
    // Something in the past with no countdown still reads as at least a day.
    expect(whenLabel({ airDateTime: '2024-02-01T00:00:00Z' }, NOW)).toBe('in 1d');
  });

  it('says nothing for a slot it cannot read', () => {
    expect(whenLabel({}, NOW)).toBe('');
    expect(whenLabel({ airDateTime: 'next Tuesday' }, NOW)).toBe('');
  });

  it('prefers the countdown over the day arithmetic', () => {
    expect(whenLabel({ countdown: '2h', airDateTime: '2024-03-09T00:00:00Z' }, NOW)).toBe('in 2h');
  });
});

describe('rowMeta', () => {
  it('prints the three short strings a row shows', () => {
    const meta = rowMeta({
      airingInfo: {
        nextEpisode: { episodeNumber: 4 },
        timing: { localTime: '11:30 PM', countdown: '45m', isLive: false }
      }
    });

    expect(meta).toEqual({
      episode: 'EP 4',
      localTime: '11:30 PM',
      countdown: 'in 45m',
      isLive: false
    });
  });

  it('prints no episode chip rather than "EP 0"', () => {
    expect(rowMeta({ airingInfo: { nextEpisode: { episodeNumber: 0 }, timing: {} } }).episode).toBe(
      ''
    );
    expect(rowMeta({ airingInfo: { timing: {} } }).episode).toBe('');
  });

  it('survives an entry with no airing information at all', () => {
    expect(rowMeta({})).toEqual({ episode: '', localTime: '', countdown: '', isLive: false });
  });

  it('reports live so the row can mark itself', () => {
    expect(
      rowMeta({ airingInfo: { timing: { isLive: true, countdown: 'AIRING NOW' } } })
    ).toMatchObject({ isLive: true, countdown: 'Now' });
  });
});

describe('railRows', () => {
  const entries = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i) }));

  it('draws only as many rows as fit beside the banner', () => {
    expect(railRows(entries(20))).toHaveLength(RAIL_LIMIT);
    expect(RAIL_LIMIT).toBe(8);
  });

  it('keeps the order it was given', () => {
    expect(railRows(entries(3)).map((e) => e.id)).toEqual(['0', '1', '2']);
  });

  it('draws whatever it has when that is fewer', () => {
    expect(railRows(entries(3))).toHaveLength(3);
    expect(railRows([])).toEqual([]);
  });
});
