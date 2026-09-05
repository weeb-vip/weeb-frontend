import { describe, it, expect } from '@jest/globals';
import {
  buildCalendarGrid,
  buildDayGroups,
  countdownFor,
  dayLabel,
  entriesOnDay,
  expandEpisodes,
  groupShowsByDay,
  isOnList,
  isoDayInZone,
  mergeAiringPages,
  monthLabel,
  resolveTimeZone,
  timezoneOptions,
  upcomingDayGroups,
  type AiringEntry,
  type AiringShow,
} from '../CurrentlyAiringPage.schedule';

/**
 * These rules used to live inside a 1444-line component, where the only way to
 * check them was to load the page and count squares. They are now a module, so
 * they get exercised directly -- particularly the grid construction and the
 * day-bucketing, which is where the calendar and the schedule list disagreed.
 */

/** An entry as `expandEpisodes` produces one, without going through it. */
function entry(iso: string, opts: { onList?: boolean; id?: string } = {}): AiringEntry {
  return {
    id: opts.id ?? `entry-${iso}`,
    anime: { id: opts.id ?? `anime-${iso}` },
    airingInfo: {
      id: opts.id ?? `anime-${iso}`,
      nextEpisodeDate: new Date(iso),
      nextEpisode: { episodeNumber: 1 },
      userAnime: opts.onList ? { status: 'WATCHING' } : null,
    },
  };
}

function show(id: string, episodes: { episodeNumber: number; airTime: string }[]): AiringShow {
  return { id, slug: `${id}-slug`, titleEn: id, duration: '24 min', episodes };
}

describe('merging airing pages', () => {
  it('unions episode lists for a show present in both pages', () => {
    // The bug this replaces: paging the calendar refetched a wider range, the
    // same show came back with a different slice of episodes, and keeping only
    // the first copy dropped every episode outside the initial window.
    const first = [show('a', [{ episodeNumber: 1, airTime: '2026-03-02T12:00:00Z' }])];
    const second = [show('a', [{ episodeNumber: 2, airTime: '2026-04-06T12:00:00Z' }])];

    const merged = mergeAiringPages(first, second);

    expect(merged).toHaveLength(1);
    expect(merged[0].episodes?.map((e) => e.episodeNumber)).toEqual([1, 2]);
  });

  it('does not duplicate an episode present in both pages', () => {
    const page = [show('a', [{ episodeNumber: 1, airTime: '2026-03-02T12:00:00Z' }])];

    expect(mergeAiringPages(page, page)[0].episodes).toHaveLength(1);
  });

  it('keeps distinct shows apart and skips rows with no id', () => {
    const merged = mergeAiringPages(
      [show('a', []), { titleEn: 'no id' } as AiringShow],
      [show('b', [])],
    );

    expect(merged.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('lets the later page win on scalar fields', () => {
    const merged = mergeAiringPages(
      [{ id: 'a', titleEn: 'stale' }],
      [{ id: 'a', titleEn: 'fresh' }],
    );

    expect(merged[0].titleEn).toBe('fresh');
  });
});

describe('expanding episodes', () => {
  const now = new Date('2026-03-01T00:00:00Z');

  it('produces one entry per episode, sorted by air time', () => {
    const entries = expandEpisodes(
      [
        show('a', [
          { episodeNumber: 2, airTime: '2026-03-10T12:00:00Z' },
          { episodeNumber: 1, airTime: '2026-03-03T12:00:00Z' },
        ]),
      ],
      now,
    );

    expect(entries.map((e) => e.airingInfo.nextEpisode.episodeNumber)).toEqual([1, 2]);
  });

  it('deduplicates the same show + episode number', () => {
    const duplicated = show('a', [
      { episodeNumber: 1, airTime: '2026-03-03T12:00:00Z' },
      { episodeNumber: 1, airTime: '2026-03-03T12:00:00Z' },
    ]);

    expect(expandEpisodes([duplicated], now)).toHaveLength(1);
  });

  it('falls back to nextEpisode when the episodes array is empty', () => {
    const entries = expandEpisodes(
      [{ id: 'a', episodes: [], nextEpisode: { episodeNumber: 7, airTime: '2026-03-04T12:00:00Z' } }],
      now,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].airingInfo.nextEpisode.episodeNumber).toBe(7);
  });

  it('drops episodes with no date at all', () => {
    expect(expandEpisodes([{ id: 'a', episodes: [{ episodeNumber: 1 }] }], now)).toHaveLength(0);
  });

  it('carries the show through as airingInfo, including the list membership', () => {
    const [only] = expandEpisodes(
      [{ ...show('a', [{ episodeNumber: 1, airTime: '2026-03-03T12:00:00Z' }]), userAnime: { status: 'WATCHING' } }],
      now,
    );

    expect(only.airingInfo.userAnime).toEqual({ status: 'WATCHING' });
    expect(only.anime.slug).toBe('a-slug');
  });
});

describe('day bucketing', () => {
  const now = new Date('2026-03-10T12:00:00Z');

  it('groups entries onto the day they air, oldest first', () => {
    const groups = buildDayGroups(
      [entry('2026-03-12T09:00:00Z'), entry('2026-03-10T09:00:00Z'), entry('2026-03-11T09:00:00Z')],
      now,
      'Etc/UTC',
    );

    expect(groups.map((g) => g.id)).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
  });

  it('marks the group that is today, and only that one', () => {
    const groups = buildDayGroups(
      [entry('2026-03-10T09:00:00Z'), entry('2026-03-11T09:00:00Z')],
      now,
      'Etc/UTC',
    );

    expect(groups.map((g) => g.isToday)).toEqual([true, false]);
  });

  it('names the weekday from the date rather than the host offset', () => {
    // 2026-03-10 is a Tuesday. A group built at 00:30 UTC used to be able to
    // read as Monday on a host west of Greenwich.
    const [group] = buildDayGroups([entry('2026-03-10T00:30:00Z')], now, 'Etc/UTC');

    expect(group.dayName).toBe('Tuesday');
    expect(group.date).toBe('Mar 10');
  });

  it('re-buckets a late-night episode onto the Japanese day in JST', () => {
    // 01:00 JST on the 11th is 16:00 UTC on the 10th. Which day it belongs to
    // is exactly the question the timezone picker asks.
    const late = [entry('2026-03-10T16:00:00Z')];

    expect(buildDayGroups(late, now, 'Etc/UTC')[0].id).toBe('2026-03-10');
    expect(buildDayGroups(late, now, 'Asia/Tokyo')[0].id).toBe('2026-03-11');
  });

  it('drops entries that are not on the list when filtered', () => {
    const groups = buildDayGroups(
      [entry('2026-03-10T09:00:00Z', { onList: true }), entry('2026-03-11T09:00:00Z')],
      now,
      'Etc/UTC',
      true,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('2026-03-10');
  });

  it('leaves nothing at all when the filter matches nothing', () => {
    expect(buildDayGroups([entry('2026-03-11T09:00:00Z')], now, 'Etc/UTC', true)).toEqual([]);
  });
});

describe('grouping shows by day for the calendar page', () => {
  it('puts one row per episode under its own day', () => {
    const byDay = groupShowsByDay(
      [
        show('a', [
          { episodeNumber: 1, airTime: '2026-03-10T09:00:00Z' },
          { episodeNumber: 2, airTime: '2026-03-17T09:00:00Z' },
        ]),
      ],
      'Etc/UTC',
    );

    expect(Object.keys(byDay).sort()).toEqual(['2026-03-10', '2026-03-17']);
    expect(byDay['2026-03-10'][0].episodes).toHaveLength(1);
    expect(byDay['2026-03-10'][0].episodes?.[0].episodeNumber).toBe(1);
  });

  it('sorts a busy day by air time', () => {
    const byDay = groupShowsByDay(
      [
        show('late', [{ episodeNumber: 1, airTime: '2026-03-10T21:00:00Z' }]),
        show('early', [{ episodeNumber: 1, airTime: '2026-03-10T06:00:00Z' }]),
      ],
      'Etc/UTC',
    );

    expect(byDay['2026-03-10'].map((row) => row.id)).toEqual(['early', 'late']);
  });

  it('falls back to nextEpisode, and skips shows with neither', () => {
    const byDay = groupShowsByDay(
      [
        { id: 'a', episodes: [], nextEpisode: { episodeNumber: 3, airTime: '2026-03-10T09:00:00Z' } },
        { id: 'b', episodes: [] },
      ],
      'Etc/UTC',
    );

    expect(byDay['2026-03-10'].map((row) => row.id)).toEqual(['a']);
  });

  it('buckets by the reader\'s zone, not the host\'s', () => {
    const late = [show('a', [{ episodeNumber: 1, airTime: '2026-03-10T16:00:00Z' }])];

    expect(Object.keys(groupShowsByDay(late, 'Etc/UTC'))).toEqual(['2026-03-10']);
    expect(Object.keys(groupShowsByDay(late, 'Asia/Tokyo'))).toEqual(['2026-03-11']);
  });

  it('has no key at all for a day with nothing airing', () => {
    const byDay = groupShowsByDay([show('a', [{ episodeNumber: 1, airTime: '2026-03-10T09:00:00Z' }])], 'Etc/UTC');

    expect(byDay['2026-03-11']).toBeUndefined();
  });
});

describe('list membership', () => {
  it('is true for a recognised status', () => {
    expect(isOnList(entry('2026-03-10T09:00:00Z', { onList: true }))).toBe(true);
  });

  it('is false when the visitor does not follow the show', () => {
    expect(isOnList(entry('2026-03-10T09:00:00Z'))).toBe(false);
  });

  it('recognises the legacy underscored spellings', () => {
    // `utils/status` is the one place that knows PLAN_TO_WATCH and PLANTOWATCH
    // are the same thing; a bare `userAnime != null` check never had to.
    const legacy = entry('2026-03-10T09:00:00Z');
    legacy.airingInfo.userAnime = { status: 'PLAN_TO_WATCH' };

    expect(isOnList(legacy)).toBe(true);
  });
});

describe('the upcoming slice of the schedule', () => {
  const now = new Date('2026-03-10T12:00:00Z');

  it('keeps today and drops everything before it', () => {
    const groups = buildDayGroups(
      [entry('2026-03-08T09:00:00Z'), entry('2026-03-10T09:00:00Z'), entry('2026-03-11T09:00:00Z')],
      now,
      'Etc/UTC',
    );

    expect(upcomingDayGroups(groups, now, 'Etc/UTC').map((g) => g.id)).toEqual([
      '2026-03-10',
      '2026-03-11',
    ]);
  });

  it('keeps today even when its episodes have already aired', () => {
    const groups = buildDayGroups([entry('2026-03-10T01:00:00Z')], now, 'Etc/UTC');

    expect(upcomingDayGroups(groups, now, 'Etc/UTC')).toHaveLength(1);
  });
});

describe('calendar grid construction', () => {
  const now = new Date('2026-03-10T12:00:00Z');
  const grid = (year: number, month: number, entries: AiringEntry[] = []) =>
    buildCalendarGrid(year, month, entries, { now, zone: 'Etc/UTC' });

  it('is a whole number of weeks', () => {
    for (let month = 0; month < 12; month++) {
      expect(grid(2026, month).length % 7).toBe(0);
    }
  });

  it('starts the week on Monday', () => {
    // 1 March 2026 is a Sunday, so it is the seventh cell and the six before it
    // belong to February.
    const days = grid(2026, 2);

    expect(days.slice(0, 6).every((d) => d.otherMonth)).toBe(true);
    expect(days[6]).toMatchObject({ num: 1, iso: '2026-03-01', otherMonth: false });
  });

  it('fills the leading cells with the previous month, ending on its last day', () => {
    const days = grid(2026, 2);

    expect(days[5]).toMatchObject({ num: 28, iso: '2026-02-28', otherMonth: true });
  });

  it('rolls the year backwards for January\'s leading cells', () => {
    const leading = grid(2026, 0).filter((d) => d.otherMonth && d.iso.startsWith('2025'));

    expect(leading.length).toBeGreaterThan(0);
    expect(leading.every((d) => d.iso.startsWith('2025-12'))).toBe(true);
  });

  it('rolls the year forwards for December\'s trailing cells', () => {
    const days = grid(2026, 11);
    const trailing = days.slice(days.findIndex((d) => d.iso === '2026-12-31') + 1);

    expect(trailing.every((d) => d.iso.startsWith('2027-01'))).toBe(true);
  });

  it('contains every day of the month exactly once', () => {
    const inMonth = grid(2026, 1).filter((d) => !d.otherMonth);

    expect(inMonth.map((d) => d.num)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
  });

  it('handles a leap February', () => {
    expect(grid(2028, 1).filter((d) => !d.otherMonth)).toHaveLength(29);
  });

  it('marks exactly one cell as today', () => {
    const today = grid(2026, 2).filter((d) => d.isToday);

    expect(today).toHaveLength(1);
    expect(today[0].iso).toBe('2026-03-10');
  });

  it('marks no cell as today in another month', () => {
    expect(grid(2026, 6).some((d) => d.isToday)).toBe(false);
  });

  it('counts the episodes airing on each day', () => {
    const days = grid(2026, 2, [
      entry('2026-03-10T09:00:00Z', { id: 'a' }),
      entry('2026-03-10T21:00:00Z', { id: 'b' }),
      entry('2026-03-12T09:00:00Z', { id: 'c' }),
    ]);

    expect(days.find((d) => d.iso === '2026-03-10')?.showCount).toBe(2);
    expect(days.find((d) => d.iso === '2026-03-12')?.showCount).toBe(1);
    expect(days.find((d) => d.iso === '2026-03-11')?.showCount).toBe(0);
  });

  it('counts onto the leading cells too, not just this month', () => {
    const days = grid(2026, 2, [entry('2026-02-28T09:00:00Z')]);

    expect(days.find((d) => d.iso === '2026-02-28')?.showCount).toBe(1);
  });

  it('counts only the list when filtered', () => {
    const days = buildCalendarGrid(
      2026,
      2,
      [
        entry('2026-03-10T09:00:00Z', { id: 'a', onList: true }),
        entry('2026-03-10T21:00:00Z', { id: 'b' }),
      ],
      { now, zone: 'Etc/UTC', myListOnly: true },
    );

    expect(days.find((d) => d.iso === '2026-03-10')?.showCount).toBe(1);
  });

  it('counts a day in the zone the reader picked', () => {
    const late = [entry('2026-03-10T16:00:00Z')];
    const utc = buildCalendarGrid(2026, 2, late, { now, zone: 'Etc/UTC' });
    const jst = buildCalendarGrid(2026, 2, late, { now, zone: 'Asia/Tokyo' });

    expect(utc.find((d) => d.iso === '2026-03-10')?.showCount).toBe(1);
    expect(jst.find((d) => d.iso === '2026-03-11')?.showCount).toBe(1);
  });

  it('agrees with the schedule list about how many shows a day has', () => {
    // The count on a square and the length of the day's group are now the same
    // computation; they used to be two hand-spelled date comparisons.
    const entries = [
      entry('2026-03-10T09:00:00Z', { id: 'a' }),
      entry('2026-03-10T21:00:00Z', { id: 'b' }),
    ];
    const cell = buildCalendarGrid(2026, 2, entries, { now, zone: 'Etc/UTC' }).find(
      (d) => d.iso === '2026-03-10',
    );

    expect(cell?.showCount).toBe(entriesOnDay(entries, '2026-03-10', 'Etc/UTC').length);
  });
});

describe('a day with nothing airing', () => {
  it('returns no entries', () => {
    expect(entriesOnDay([entry('2026-03-10T09:00:00Z')], '2026-03-11', 'Etc/UTC')).toEqual([]);
  });

  it('still gets a cell, with a zero count', () => {
    const day = buildCalendarGrid(2026, 2, [], {
      now: new Date('2026-03-10T12:00:00Z'),
      zone: 'Etc/UTC',
    }).find((d) => d.iso === '2026-03-11');

    expect(day).toBeDefined();
    expect(day?.showCount).toBe(0);
  });
});

describe('countdown text', () => {
  const now = new Date('2026-03-10T12:00:00Z');

  it('reads LIVE for the half hour after the slot opens', () => {
    expect(countdownFor(new Date('2026-03-10T11:45:00Z'), now)).toEqual({
      text: 'LIVE',
      status: 'airing-now',
    });
  });

  it('reads LIVE exactly on the hour it airs', () => {
    expect(countdownFor(now, now).status).toBe('airing-now');
  });

  it('reads Aired once the half hour is up', () => {
    expect(countdownFor(new Date('2026-03-10T11:00:00Z'), now)).toEqual({
      text: 'Aired',
      status: 'aired',
    });
  });

  it('counts down in hours and padded minutes inside a day', () => {
    expect(countdownFor(new Date('2026-03-10T15:05:00Z'), now).text).toBe('In 3h 05m');
  });

  it('counts down in days and hours beyond that', () => {
    expect(countdownFor(new Date('2026-03-13T17:00:00Z'), now).text).toBe('In 3d 5h');
  });
});

describe('timezone plumbing', () => {
  it('offers the browser zone first, under its own name', () => {
    expect(timezoneOptions('Europe/Berlin')[0]).toEqual({
      value: 'local',
      label: 'Europe/Berlin',
    });
  });

  it('resolves local back to the browser zone', () => {
    expect(resolveTimeZone('local', 'Europe/Berlin')).toBe('Europe/Berlin');
  });

  it('resolves a named zone to a fixed offset that matches its label', () => {
    // "EST (UTC-5)" has to still be UTC-5 in July, which America/New_York is not.
    expect(isoDayInZone(new Date('2026-07-01T03:00:00Z'), resolveTimeZone('EST', 'UTC'))).toBe(
      '2026-06-30',
    );
  });

  it('falls back to the browser zone for a value it does not know', () => {
    expect(resolveTimeZone('nonsense', 'Europe/Berlin')).toBe('Europe/Berlin');
  });
});

describe('labels', () => {
  it('names the month and year', () => {
    expect(monthLabel(2026, 2)).toBe('March 2026');
  });

  it('spells a selected day out in full', () => {
    expect(dayLabel('2026-03-10')).toBe('Tuesday, March 10, 2026');
  });

  it('has a placeholder for no selection', () => {
    expect(dayLabel(null)).toBe('--');
  });
});
