import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readable } from 'svelte/store';
import { QueryClient } from '@tanstack/svelte-query';
import {
  CurrentlyAiringPageBloc,
  type AiringQueryPort,
  type CurrentlyAiringDeps,
} from './CurrentlyAiringPage.bloc.svelte';
import type { AiringShow } from './CurrentlyAiringPage.schedule';

/**
 * The airing page's *bloc*, not its arithmetic. Every pure rule it leans on
 * (merging, bucketing, the grid, countdowns, zone resolution) already has a
 * test in `CurrentlyAiringPage.schedule.test.ts`; nothing here re-checks those.
 *
 * What is pinned here is the wiring, which is where the page was actually
 * broken:
 *
 *  - the timezone picker used to be bound to a variable nothing read, so
 *    choosing JST moved the dropdown and nothing else. Every derived read that
 *    takes a zone is therefore asserted through `selectTimezone`, not through
 *    the helpers.
 *  - the my-list filter and the view switch were done by reaching into the DOM
 *    and setting `style.display`, so state and markup could disagree. They are
 *    now state, and the filter has to reach every derived read at once.
 *  - paging the calendar outside the initially fetched window refetched a wider
 *    range and *replaced* the data, blanking the months already in hand.
 *
 * Ports are all stubbed: a pinned clock, a recording query port, an inert
 * QueryClient. Nothing here touches the network or the real query client.
 */

// The day a UTC instant falls on is host-independent, but the fetched range
// (`new Date(year, month, 1)`) and the calendar's opening month are read off
// the host's own clock. Pinning the host zone makes those exact.
let hostZone: string | undefined;
beforeAll(() => {
  hostZone = process.env.TZ;
  process.env.TZ = 'UTC';
});
afterAll(() => {
  process.env.TZ = hostZone;
});

afterEach(() => {
  vi.useRealTimers();
});

/** Wednesday, mid-day UTC, mid-month: no host zone can drag it into February. */
const NOW = new Date('2026-03-11T12:00:00Z');

type Ep = { episodeNumber: number; airTime?: string | null; airDate?: string | null };

function show(
  id: string,
  episodes: Ep[],
  opts: { onList?: boolean; titleEn?: string; titleJp?: string; slug?: string | null } = {},
): AiringShow {
  return {
    id,
    slug: opts.slug === undefined ? `${id}-slug` : opts.slug,
    titleEn: opts.titleEn ?? `${id} (en)`,
    titleJp: opts.titleJp ?? `${id} (jp)`,
    duration: '24 min',
    imageUrl: `${id}.jpg`,
    userAnime: opts.onList ? { status: 'WATCHING' } : null,
    episodes,
  };
}

/** One episode per day, `count` days running, starting `startIso` at 12:00 UTC. */
function dailyShows(count: number, startDay: number): AiringShow[] {
  return Array.from({ length: count }, (_, i) =>
    show(`day${i}`, [
      { episodeNumber: 1, airTime: `2026-03-${String(startDay + i).padStart(2, '0')}T12:00:00Z` },
    ]),
  );
}

type Payload = { currentlyAiring?: AiringShow[] | null } | null | undefined;

/**
 * The airing query as a port that records how it was asked and what it was
 * asked for. The key carries the whole range so the widening fetch cannot be
 * served the main query's cached page by accident.
 */
function recordingAiring(handler: (limit?: number) => Promise<Payload>) {
  const asked: { start: Date; end: Date | null | undefined; days?: number; limit?: number }[] = [];
  const fetched: number[] = [];
  const port: AiringQueryPort = (start, end, days, limit) => {
    asked.push({ start, end, days, limit });
    return {
      queryKey: ['airing', start.toISOString(), end?.toISOString() ?? null, days ?? null, limit ?? null],
      queryFn: async () => {
        fetched.push(limit ?? 0);
        return handler(limit);
      },
    };
  };
  return { port, asked, fetched };
}

/**
 * A client of this test's own, so nothing reaches the app's shared one.
 *
 * `gcTime` has to stay generous: outside a component the bloc's `fromStore`
 * falls back to `get(store)`, which subscribes and unsubscribes on every read,
 * and a zero gcTime would evict the query between two reads of the same bloc.
 */
function inertClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
}

function makeBloc(deps: CurrentlyAiringDeps = {}) {
  return new CurrentlyAiringPageBloc({
    source: () => ({ ssrData: null }),
    airing: () => ({
      queryKey: ['airing', 'unused'],
      queryFn: async () => {
        throw new Error('the test did not expect a fetch');
      },
    }),
    queryClient: inertClient(),
    preferences: readable({ titleLanguage: 'english' as const }),
    clock: () => NOW,
    localZone: () => 'America/New_York',
    navigate: () => {},
    addAnime: { add: () => {} },
    ...deps,
  });
}

/** A bloc whose data is already in hand, via the loader payload. */
function loaded(shows: AiringShow[], deps: CurrentlyAiringDeps = {}) {
  return makeBloc({ source: () => ({ ssrData: { currentlyAiring: shows } }), ...deps });
}

/**
 * A seeded bloc whose next fetch blows up.
 *
 * The failure is reached through `retry()` rather than a cold load on purpose.
 * Outside a component the bloc's `fromStore` has no effect to track, so every
 * read of a getter subscribes and unsubscribes again; a query with no data
 * re-fetches on each of those mounts, which resets the error before it can be
 * read. Seeding `initialData` makes the query's `refetchOnMount: false` apply,
 * so the error settles and stays put -- and it is the realistic case anyway: an
 * SSR'd page whose background refresh fails.
 */
function failingRefetch(fail: () => never, recovery?: { currentlyAiring: AiringShow[] }) {
  let attempt = 0;
  const bloc = loaded([show('a', [{ episodeNumber: 1, airTime: '2026-03-12T12:00:00Z' }])], {
    airing: () => ({
      queryKey: ['airing', 'failing'],
      queryFn: async () => {
        attempt += 1;
        if (attempt === 1) fail();
        return recovery ?? null;
      },
    }),
  });
  return { bloc, attempts: () => attempt };
}

/**
 * 00:30 on 13 March in Tokyo, 11:30 on the 12th in New York: one instant, two
 * calendar days. Every zone assertion below hangs off this episode.
 */
const LATE_NIGHT_JST = '2026-03-12T15:30:00Z';

describe('query state', () => {
  it('is loading while the first fetch is in flight, with nothing to show', () => {
    const bloc = makeBloc({
      airing: () => ({ queryKey: ['airing', 'pending'], queryFn: () => new Promise<Payload>(() => {}) }),
    });

    expect(bloc.isLoading).toBe(true);
    expect(bloc.isRetrying).toBe(true);
    expect(bloc.isEmpty).toBe(true);
    expect(bloc.scheduleDays).toEqual([]);
  });

  it('is not loading when the loader already handed over a payload', () => {
    // The whole point of seeding `initialData`: an SSR'd page must paint the
    // schedule on the first frame rather than a skeleton.
    const bloc = loaded([show('a', [{ episodeNumber: 1, airTime: LATE_NIGHT_JST }])]);

    expect(bloc.isLoading).toBe(false);
    expect(bloc.isEmpty).toBe(false);
    expect(bloc.entries).toHaveLength(1);
  });

  it('takes the SSR payload over waiting for the query', async () => {
    const airing = recordingAiring(async () => ({ currentlyAiring: [show('later', [])] }));
    const bloc = loaded([show('ssr', [{ episodeNumber: 1, airTime: LATE_NIGHT_JST }])], {
      airing: airing.port,
    });

    expect(bloc.entries[0].airingInfo.id).toBe('ssr');
    // `refetchOnMount: false` plus a two-minute staleTime: the seeded page is
    // not thrown away and immediately re-requested.
    await Promise.resolve();
    expect(airing.fetched).toEqual([]);
  });

  it('surfaces the failure and its message when the port rejects', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { bloc } = failingRefetch(() => {
      throw new Error('upstream exploded');
    });

    bloc.retry();

    await vi.waitFor(() => expect(bloc.isError).toBe(true));
    expect(bloc.errorDetail).toBe('upstream exploded');
    // A failed refresh must not blank the page that is already on screen.
    expect(bloc.entries).toHaveLength(1);
    expect(logged).not.toHaveBeenCalled();
    logged.mockRestore();
  });

  it('has no error detail when the rejection carries no message', async () => {
    const { bloc } = failingRefetch(() => {
      throw 'no message on this one';
    });

    bloc.retry();

    await vi.waitFor(() => expect(bloc.isError).toBe(true));
    expect(bloc.errorDetail).toBe('');
  });

  it('asks again, and recovers, when retry is pressed', async () => {
    const { bloc, attempts } = failingRefetch(
      () => {
        throw new Error('first try');
      },
      { currentlyAiring: [show('a', [{ episodeNumber: 1, airTime: LATE_NIGHT_JST }]), show('b', [{ episodeNumber: 1, airTime: LATE_NIGHT_JST }])] },
    );

    bloc.retry();
    await vi.waitFor(() => expect(bloc.isError).toBe(true));

    bloc.retry();
    await vi.waitFor(() => expect(bloc.isError).toBe(false));

    expect(attempts()).toBe(2);
    expect(bloc.entries).toHaveLength(2);
  });

  it('asks for the month it opens on and the one after it', () => {
    const airing = recordingAiring(async () => null);
    makeBloc({ airing: airing.port });

    expect(airing.asked[0].start.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(airing.asked[0].end?.toISOString()).toBe('2026-04-30T00:00:00.000Z');
    expect(airing.asked[0].limit).toBe(100);
  });
});

describe('empty and malformed payloads', () => {
  it('is empty for a null payload', async () => {
    const bloc = makeBloc({ airing: () => ({ queryKey: ['airing', 'null'], queryFn: async () => null }) });

    await vi.waitFor(() => expect(bloc.isLoading).toBe(false));
    expect(bloc.isEmpty).toBe(true);
    expect(bloc.scheduleDays).toEqual([]);
    expect(bloc.hasMoreDays).toBe(false);
  });

  it('is empty when the payload has no shows at all', () => {
    expect(loaded([]).isEmpty).toBe(true);
  });

  it('is empty when a show carries no episodes and no next episode', () => {
    expect(loaded([show('a', [])]).isEmpty).toBe(true);
  });

  it('drops an episode with neither an air date nor an air time', () => {
    const bloc = loaded([show('a', [{ episodeNumber: 1 }, { episodeNumber: 2, airTime: LATE_NIGHT_JST }])]);

    expect(bloc.entries).toHaveLength(1);
    expect(bloc.entries[0].airingInfo.nextEpisode.episodeNumber).toBe(2);
  });

  it('has an empty calendar grid of the right size with no data', () => {
    const bloc = loaded([]);

    // March 2026 opens on a Sunday, so the Monday-first grid runs to six rows.
    expect(bloc.calendarDays).toHaveLength(42);
    expect(bloc.calendarDays.every((day) => day.showCount === 0)).toBe(true);
  });
});

describe('timezone selection drives every day boundary', () => {
  /** One late-night-JST episode plus one that is nowhere near a boundary. */
  function zoneBloc() {
    return loaded([
      show('late', [{ episodeNumber: 1, airTime: LATE_NIGHT_JST }]),
      show('mid', [{ episodeNumber: 1, airTime: '2026-03-15T12:00:00Z' }]),
    ]);
  }

  it('resolves the picker value to an IANA zone, and "local" to the viewer"s own', () => {
    const bloc = zoneBloc();

    expect(bloc.timezone).toBe('local');
    expect(bloc.zone).toBe('America/New_York');

    bloc.selectTimezone('JST');
    expect(bloc.timezone).toBe('JST');
    expect(bloc.zone).toBe('Asia/Tokyo');

    bloc.selectTimezone('local');
    expect(bloc.zone).toBe('America/New_York');
  });

  it('falls back to the viewer"s zone for a value the picker does not know', () => {
    const bloc = zoneBloc();
    bloc.selectTimezone('Mars/Olympus');

    expect(bloc.zone).toBe('America/New_York');
  });

  it('offers the viewer"s own zone first, then the fixed offsets', () => {
    expect(zoneBloc().timezones[0]).toEqual({ value: 'local', label: 'America/New_York' });
    expect(zoneBloc().timezones.map((option) => option.value)).toEqual([
      'local',
      'JST',
      'EST',
      'GMT',
      'PST',
      'CET',
    ]);
  });

  it('re-buckets the schedule days when the zone changes', () => {
    // The regression: the select was bound to a variable nothing read, so this
    // list was identical whatever was chosen.
    const bloc = zoneBloc();
    expect(bloc.scheduleDays.map((day) => day.id)).toEqual(['2026-03-12', '2026-03-15']);

    bloc.selectTimezone('JST');
    expect(bloc.scheduleDays.map((day) => day.id)).toEqual(['2026-03-13', '2026-03-15']);
  });

  it('moves the entry itself, not merely the heading', () => {
    const bloc = zoneBloc();
    bloc.selectTimezone('JST');

    const day = bloc.scheduleDays.find((group) => group.id === '2026-03-13');
    expect(day?.entries.map((entry) => entry.airingInfo.id)).toEqual(['late']);
    expect(bloc.scheduleDays.find((group) => group.id === '2026-03-12')).toBeUndefined();
  });

  it('re-labels the day, because the weekday moves with it', () => {
    const bloc = zoneBloc();
    expect(bloc.scheduleDays[0].dayName).toBe('Thursday');
    expect(bloc.scheduleDays[0].date).toBe('Mar 12');

    bloc.selectTimezone('JST');
    expect(bloc.scheduleDays[0].dayName).toBe('Friday');
    expect(bloc.scheduleDays[0].date).toBe('Mar 13');
  });

  it('moves the calendar cell the episode is counted on', () => {
    const bloc = zoneBloc();
    const countOn = (iso: string) => bloc.calendarDays.find((day) => day.iso === iso)?.showCount;

    expect(countOn('2026-03-12')).toBe(1);
    expect(countOn('2026-03-13')).toBe(0);

    bloc.selectTimezone('JST');
    expect(countOn('2026-03-12')).toBe(0);
    expect(countOn('2026-03-13')).toBe(1);
  });

  it('moves the selected day"s list too, so the panel and the grid agree', () => {
    const bloc = zoneBloc();
    bloc.selectDay('2026-03-12');
    expect(bloc.selectedDayEntries.map((entry) => entry.airingInfo.id)).toEqual(['late']);

    bloc.selectTimezone('JST');
    bloc.selectDay('2026-03-12');
    expect(bloc.selectedDayEntries).toEqual([]);

    bloc.selectDay('2026-03-13');
    expect(bloc.selectedDayEntries.map((entry) => entry.airingInfo.id)).toEqual(['late']);
  });

  it('renders the clock face in the chosen zone', () => {
    const bloc = zoneBloc();
    const late = bloc.entries.find((entry) => entry.airingInfo.id === 'late')!;

    expect(bloc.timeFor(late)).toBe('11:30');

    bloc.selectTimezone('JST');
    expect(bloc.timeFor(late)).toBe('00:30');

    bloc.selectTimezone('PST');
    expect(bloc.timeFor(late)).toBe('07:30');
  });

  it('clears the selected day, so the panel cannot keep a heading with nothing under it', () => {
    const bloc = zoneBloc();
    bloc.selectDay('2026-03-12');

    bloc.selectTimezone('JST');

    expect(bloc.selectedDay).toBeNull();
    expect(bloc.selectedDayEntries).toEqual([]);
    expect(bloc.selectedDayLabel).toBe('--');
  });

  it('does not change which episodes exist, only which day they land on', () => {
    const bloc = zoneBloc();
    const before = bloc.entries.map((entry) => entry.id);

    bloc.selectTimezone('JST');

    expect(bloc.entries.map((entry) => entry.id)).toEqual(before);
    expect(bloc.isEmpty).toBe(false);
  });
});

describe('the my-list filter', () => {
  function filterBloc() {
    return loaded([
      show('mine', [{ episodeNumber: 1, airTime: '2026-03-12T12:00:00Z' }], { onList: true }),
      show('theirs', [{ episodeNumber: 1, airTime: '2026-03-12T18:00:00Z' }]),
      show('other-day', [{ episodeNumber: 1, airTime: '2026-03-15T12:00:00Z' }]),
    ]);
  }

  it('is off to begin with', () => {
    const bloc = filterBloc();

    expect(bloc.myListOnly).toBe(false);
    expect(bloc.scheduleDays.flatMap((day) => day.entries)).toHaveLength(3);
  });

  it('removes what the viewer does not follow from the day groups', () => {
    const bloc = filterBloc();
    bloc.toggleMyListOnly();

    expect(bloc.myListOnly).toBe(true);
    expect(bloc.scheduleDays.map((day) => day.id)).toEqual(['2026-03-12']);
    expect(bloc.scheduleDays[0].entries.map((entry) => entry.airingInfo.id)).toEqual(['mine']);
  });

  it('drops the per-day calendar counts to match', () => {
    const bloc = filterBloc();
    const countOn = (iso: string) => bloc.calendarDays.find((day) => day.iso === iso)?.showCount;

    expect(countOn('2026-03-12')).toBe(2);
    expect(countOn('2026-03-15')).toBe(1);

    bloc.toggleMyListOnly();

    // The calendar and the list used to compute this two different ways, so a
    // day could show "2 shows" over an empty panel.
    expect(countOn('2026-03-12')).toBe(1);
    expect(countOn('2026-03-15')).toBe(0);
  });

  it('filters the selected day"s list as well', () => {
    const bloc = filterBloc();
    bloc.selectDay('2026-03-12');
    expect(bloc.selectedDayEntries).toHaveLength(2);

    bloc.toggleMyListOnly();
    expect(bloc.selectedDayEntries.map((entry) => entry.airingInfo.id)).toEqual(['mine']);
  });

  it('leaves the unfiltered entry list alone, so nothing is lost', () => {
    const bloc = filterBloc();
    bloc.toggleMyListOnly();

    expect(bloc.entries).toHaveLength(3);
    expect(bloc.isEmpty).toBe(false);
  });

  it('restores everything when toggled back off', () => {
    const bloc = filterBloc();
    const before = bloc.scheduleDays.map((day) => `${day.id}:${day.entries.length}`);

    bloc.toggleMyListOnly();
    bloc.toggleMyListOnly();

    expect(bloc.myListOnly).toBe(false);
    expect(bloc.scheduleDays.map((day) => `${day.id}:${day.entries.length}`)).toEqual(before);
  });

  it('restores everything when the "show all" escape hatch is used', () => {
    const bloc = filterBloc();
    bloc.toggleMyListOnly();

    bloc.showAllAnime();

    expect(bloc.myListOnly).toBe(false);
    expect(bloc.scheduleDays.flatMap((day) => day.entries)).toHaveLength(3);
  });

  it('leaves an empty schedule, not the unfiltered one, when nothing matches', () => {
    const bloc = loaded([
      show('theirs', [{ episodeNumber: 1, airTime: '2026-03-12T12:00:00Z' }]),
      show('also-theirs', [{ episodeNumber: 1, airTime: '2026-03-15T12:00:00Z' }]),
    ]);

    bloc.toggleMyListOnly();

    expect(bloc.scheduleDays).toEqual([]);
    expect(bloc.calendarDays.every((day) => day.showCount === 0)).toBe(true);
    expect(bloc.hasMoreDays).toBe(false);
  });

  it('says the schedule is filtered out rather than empty when the filter is what emptied it', () => {
    const bloc = loaded([show('theirs', [{ episodeNumber: 1, airTime: '2026-03-12T12:00:00Z' }])]);
    expect(bloc.isFilteredOut).toBe(false);

    bloc.toggleMyListOnly();

    // A different message from "nothing is airing", and it offers a way back.
    expect(bloc.isFilteredOut).toBe(true);
    expect(bloc.isEmpty).toBe(false);
  });

  it('is not "filtered out" when there was nothing to begin with', () => {
    const bloc = loaded([]);
    bloc.toggleMyListOnly();

    expect(bloc.isFilteredOut).toBe(false);
    expect(bloc.isEmpty).toBe(true);
  });

  it('is not "filtered out" while the filter is off, however empty the schedule is', () => {
    // Only past episodes: the schedule is empty, but not because of the filter.
    const bloc = loaded([show('old', [{ episodeNumber: 1, airTime: '2026-01-05T12:00:00Z' }])]);

    expect(bloc.scheduleDays).toEqual([]);
    expect(bloc.isFilteredOut).toBe(false);
  });

  it('changes the empty-day message so the panel explains itself', () => {
    const bloc = filterBloc();
    expect(bloc.emptyDayMessage).toBe('No shows airing this day');

    bloc.toggleMyListOnly();
    expect(bloc.emptyDayMessage).toBe('No shows from your list airing this day');
  });

  it('recognises the legacy list spellings as being on the list', () => {
    const bloc = loaded([
      show('legacy', [{ episodeNumber: 1, airTime: '2026-03-12T12:00:00Z' }]),
    ]);
    // `userAnime` is spread onto the entry from the show; the legacy snake_case
    // status has to count, or a filtered schedule silently loses rows.
    const legacy = loaded([
      { ...show('legacy', [{ episodeNumber: 1, airTime: '2026-03-12T12:00:00Z' }]), userAnime: { status: 'PLAN_TO_WATCH' } },
    ]);

    expect(bloc.isOnList(bloc.entries[0])).toBe(false);
    expect(legacy.isOnList(legacy.entries[0])).toBe(true);

    legacy.toggleMyListOnly();
    expect(legacy.scheduleDays.flatMap((day) => day.entries)).toHaveLength(1);
  });
});

describe('the schedule slice and "show more days"', () => {
  it('shows a week to begin with and says how many more there are', () => {
    const bloc = loaded(dailyShows(10, 12));

    expect(bloc.scheduleDays).toHaveLength(7);
    expect(bloc.scheduleDays[0].id).toBe('2026-03-12');
    expect(bloc.hasMoreDays).toBe(true);
    expect(bloc.nextDayBatch).toBe(3);
  });

  it('reveals the next batch and then stops offering one', () => {
    const bloc = loaded(dailyShows(10, 12));
    bloc.showMoreDays();

    expect(bloc.scheduleDays).toHaveLength(10);
    expect(bloc.hasMoreDays).toBe(false);
  });

  it('lets nextDayBatch go negative once everything is revealed', () => {
    // Current behaviour, not desired behaviour: `nextDayBatch` is
    // `min(7, upcoming - visible)` with no floor, so it reads -4 here. Only
    // `hasMoreDays` keeps that number off the screen. Pinned so that a future
    // change to the button's condition cannot silently ship "Show next -4 days".
    const bloc = loaded(dailyShows(10, 12));
    bloc.showMoreDays();

    expect(bloc.nextDayBatch).toBe(-4);
  });

  it('reveals a full week when there is more than a week left', () => {
    const bloc = loaded(dailyShows(20, 12));

    expect(bloc.nextDayBatch).toBe(7);
    bloc.showMoreDays();
    expect(bloc.scheduleDays).toHaveLength(14);
    expect(bloc.nextDayBatch).toBe(6);
  });

  it('offers nothing more when a week covers everything', () => {
    const bloc = loaded(dailyShows(3, 12));

    expect(bloc.scheduleDays).toHaveLength(3);
    expect(bloc.hasMoreDays).toBe(false);
  });

  it('opens on today rather than on last week', () => {
    const bloc = loaded([
      show('past', [{ episodeNumber: 1, airTime: '2026-03-05T12:00:00Z' }]),
      show('today', [{ episodeNumber: 1, airTime: '2026-03-11T20:00:00Z' }]),
    ]);

    expect(bloc.scheduleDays.map((day) => day.id)).toEqual(['2026-03-11']);
    expect(bloc.scheduleDays[0].isToday).toBe(true);
    // The past episode is still in the data, for the calendar to draw.
    expect(bloc.entries).toHaveLength(2);
  });

  it('counts the days behind the filter, not the unfiltered ones', () => {
    const shows = dailyShows(10, 12);
    shows[0] = { ...shows[0], userAnime: { status: 'WATCHING' } };
    const bloc = loaded(shows);

    bloc.toggleMyListOnly();

    expect(bloc.scheduleDays).toHaveLength(1);
    expect(bloc.hasMoreDays).toBe(false);
  });
});

describe('per-day collapse', () => {
  it('starts with every day expanded', () => {
    const bloc = loaded(dailyShows(2, 12));

    expect(bloc.isCollapsed('2026-03-12')).toBe(false);
  });

  it('toggles one day without touching its neighbour', () => {
    const bloc = loaded(dailyShows(2, 12));
    bloc.toggleDay('2026-03-12');

    expect(bloc.isCollapsed('2026-03-12')).toBe(true);
    expect(bloc.isCollapsed('2026-03-13')).toBe(false);
  });

  it('toggles back', () => {
    const bloc = loaded(dailyShows(2, 12));
    bloc.toggleDay('2026-03-12');
    bloc.toggleDay('2026-03-12');

    expect(bloc.isCollapsed('2026-03-12')).toBe(false);
  });
});

describe('the view switch', () => {
  it('opens on the schedule', () => {
    expect(loaded([]).view).toBe('schedule');
  });

  it('switches to the calendar', () => {
    const bloc = loaded([]);
    bloc.selectView('calendar');

    expect(bloc.view).toBe('calendar');
  });

  it('treats anything that is not "calendar" as the schedule', () => {
    // The value arrives from a `<select>`; a value nobody recognises must not
    // leave the page rendering neither view.
    const bloc = loaded([]);
    bloc.selectView('calendar');
    bloc.selectView('nonsense');

    expect(bloc.view).toBe('schedule');
  });
});

describe('paging the calendar months', () => {
  function pagingBloc(extra: AiringShow[] = [], deps: CurrentlyAiringDeps = {}) {
    const airing = recordingAiring(async () => ({ currentlyAiring: extra }));
    const bloc = loaded([show('a', [{ episodeNumber: 1, airTime: '2026-03-12T12:00:00Z' }])], {
      airing: airing.port,
      queryClient: inertClient(),
      ...deps,
    });
    return { bloc, airing };
  }

  it('opens on the month the clock says it is', () => {
    expect(loaded([]).monthLabel).toBe('March 2026');
  });

  it('moves forward and back a month at a time', () => {
    const { bloc } = pagingBloc();

    bloc.nextMonth();
    expect(bloc.monthLabel).toBe('April 2026');

    bloc.previousMonth();
    expect(bloc.monthLabel).toBe('March 2026');
  });

  it('rolls back over the year boundary', () => {
    const bloc = makeBloc({ clock: () => new Date('2026-01-15T12:00:00Z') });
    bloc.previousMonth();

    expect(bloc.monthLabel).toBe('December 2025');
  });

  it('rolls forward over the year boundary', () => {
    const bloc = makeBloc({ clock: () => new Date('2026-12-15T12:00:00Z') });
    bloc.nextMonth();

    expect(bloc.monthLabel).toBe('January 2027');
  });

  it('redraws the grid for the month it moved to', () => {
    const { bloc } = pagingBloc();
    bloc.nextMonth();

    const inMonth = bloc.calendarDays.filter((day) => !day.otherMonth);
    expect(inMonth).toHaveLength(30);
    expect(inMonth[0].iso).toBe('2026-04-01');
    expect(inMonth.at(-1)!.iso).toBe('2026-04-30');
  });

  it('clears the selected day, which belonged to the month just left', () => {
    const { bloc } = pagingBloc();
    bloc.selectDay('2026-03-12');

    bloc.nextMonth();

    expect(bloc.selectedDay).toBeNull();
  });

  it('does not refetch for a month the opening query already covers', async () => {
    const { bloc, airing } = pagingBloc();

    bloc.nextMonth(); // April, inside the two-month opening window.

    expect(bloc.calendarLoading).toBe(false);
    await Promise.resolve();
    expect(airing.fetched).toEqual([]);
  });

  it('widens the range and refetches for a month outside the window', async () => {
    const { bloc, airing } = pagingBloc();

    bloc.nextMonth();
    bloc.nextMonth(); // May: past the opening window's end.

    expect(bloc.calendarLoading).toBe(true);
    await vi.waitFor(() => expect(bloc.calendarLoading).toBe(false));

    const widened = airing.asked.at(-1)!;
    expect(widened.start.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(widened.end?.toISOString()).toBe('2026-05-31T00:00:00.000Z');
    expect(widened.limit).toBe(200);
  });

  it('widens backwards for a month before the window', async () => {
    const { bloc, airing } = pagingBloc();

    bloc.previousMonth(); // February: before the opening window's start.
    await vi.waitFor(() => expect(bloc.calendarLoading).toBe(false));

    const widened = airing.asked.at(-1)!;
    expect(widened.start.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(widened.end?.toISOString()).toBe('2026-04-30T00:00:00.000Z');
  });

  it('unions the widened page into the data instead of replacing it', async () => {
    // The bug: the wider fetch came back with a different slice of the same
    // show's episodes, the first copy won, and the calendar went blank one
    // click away from today.
    const { bloc } = pagingBloc([
      show('a', [
        { episodeNumber: 1, airTime: '2026-03-12T12:00:00Z' },
        { episodeNumber: 2, airTime: '2026-05-12T12:00:00Z' },
      ]),
    ]);

    bloc.nextMonth();
    bloc.nextMonth();
    await vi.waitFor(() => expect(bloc.entries).toHaveLength(2));

    expect(bloc.entries.map((entry) => entry.id)).toEqual(['airing-a-ep1', 'airing-a-ep2']);
    expect(bloc.calendarDays.find((day) => day.iso === '2026-05-12')?.showCount).toBe(1);
  });

  it('does not duplicate an episode that came back in both pages', async () => {
    const { bloc } = pagingBloc([show('a', [{ episodeNumber: 1, airTime: '2026-03-12T12:00:00Z' }])]);

    bloc.nextMonth();
    bloc.nextMonth();
    await vi.waitFor(() => expect(bloc.calendarLoading).toBe(false));

    expect(bloc.entries).toHaveLength(1);
  });

  it('keeps the months already in hand when the widening fetch fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const airing: AiringQueryPort = (start, end, days, limit) => ({
      queryKey: ['airing', start.toISOString(), end?.toISOString() ?? null, limit ?? null],
      queryFn: async () => {
        throw new Error('the wider range blew up');
      },
    });
    const bloc = loaded([show('a', [{ episodeNumber: 1, airTime: '2026-03-12T12:00:00Z' }])], { airing });

    bloc.nextMonth();
    bloc.nextMonth();
    await vi.waitFor(() => expect(bloc.calendarLoading).toBe(false));

    // No error banner over the whole page: the calendar is still usable.
    expect(bloc.isError).toBe(false);
    expect(bloc.entries).toHaveLength(1);
    logged.mockRestore();
  });

  it('does not ask twice for a month it has already widened to', async () => {
    const { bloc, airing } = pagingBloc();

    bloc.nextMonth();
    bloc.nextMonth();
    await vi.waitFor(() => expect(bloc.calendarLoading).toBe(false));
    const after = airing.fetched.length;

    bloc.previousMonth();
    bloc.nextMonth();
    await Promise.resolve();

    expect(airing.fetched).toHaveLength(after);
  });
});

describe('selecting a day', () => {
  function dayBloc() {
    return loaded([
      show('a', [{ episodeNumber: 1, airTime: '2026-03-12T12:00:00Z' }]),
      show('b', [{ episodeNumber: 1, airTime: '2026-03-12T04:00:00Z' }]),
      show('c', [{ episodeNumber: 1, airTime: '2026-03-15T12:00:00Z' }]),
    ]);
  }

  it('has no day selected to begin with', () => {
    const bloc = dayBloc();

    expect(bloc.selectedDay).toBeNull();
    expect(bloc.selectedDayEntries).toEqual([]);
    expect(bloc.selectedDayLabel).toBe('--');
  });

  it('lists only what airs on the chosen day, in air order', () => {
    const bloc = dayBloc();
    bloc.selectDay('2026-03-12');

    expect(bloc.selectedDayEntries.map((entry) => entry.airingInfo.id)).toEqual(['b', 'a']);
  });

  it('labels the chosen day in full', () => {
    const bloc = dayBloc();
    bloc.selectDay('2026-03-12');

    expect(bloc.selectedDayLabel).toBe('Thursday, March 12, 2026');
  });

  it('is empty for a day nothing airs on, rather than falling back to everything', () => {
    const bloc = dayBloc();
    bloc.selectDay('2026-03-13');

    expect(bloc.selectedDayEntries).toEqual([]);
  });

  it('can be moved from one day to another', () => {
    const bloc = dayBloc();
    bloc.selectDay('2026-03-12');
    bloc.selectDay('2026-03-15');

    expect(bloc.selectedDay).toBe('2026-03-15');
    expect(bloc.selectedDayEntries.map((entry) => entry.airingInfo.id)).toEqual(['c']);
  });
});

describe('per-entry reads', () => {
  const airTime = '2026-03-12T12:00:00Z';

  function entryOf(deps: CurrentlyAiringDeps = {}, over: Partial<AiringShow> = {}) {
    const bloc = loaded([{ ...show('a', [{ episodeNumber: 7, airTime }]), ...over }], deps);
    return { bloc, entry: bloc.entries[0] };
  }

  it('titles an entry in the reader"s preferred language', () => {
    const english = entryOf();
    expect(english.bloc.titleFor(english.entry)).toBe('a (en)');

    const japanese = entryOf({ preferences: readable({ titleLanguage: 'japanese' as const }) });
    expect(japanese.bloc.titleFor(japanese.entry)).toBe('a (jp)');
  });

  it('numbers the episode, and says nothing when there is no number', () => {
    const numbered = entryOf();
    expect(numbered.bloc.episodeFor(numbered.entry)).toBe('Ep 7');

    const unnumbered = entryOf({}, { episodes: [{ episodeNumber: null, airTime }] });
    expect(unnumbered.bloc.episodeFor(unnumbered.entry)).toBe('');
  });

  it('counts down from the pinned clock', () => {
    const { bloc, entry } = entryOf();

    // 2026-03-11T12:00Z to 2026-03-12T12:00Z is exactly a day.
    expect(bloc.countdownFor(entry)).toEqual({ text: 'In 1d 0h', status: 'upcoming' });
  });

  it('links by slug, and by id when there is no slug', () => {
    const bySlug = entryOf();
    expect(bySlug.bloc.hrefFor(bySlug.entry)).toBe('/anime/a-slug');

    const byId = entryOf({}, { slug: null });
    expect(byId.bloc.hrefFor(byId.entry)).toBe('/anime/a');
  });

  it('builds an image URL from the show id at the requested width', () => {
    const { bloc, entry } = entryOf();

    expect(bloc.imageFor(entry, 320)).toContain('/a');
    expect(typeof bloc.imageFor(entry, 320)).toBe('string');
  });

  it('reports whether the entry is on the reader"s list', () => {
    const off = entryOf();
    expect(off.bloc.isOnList(off.entry)).toBe(false);

    const on = entryOf({}, { userAnime: { status: 'WATCHING' } });
    expect(on.bloc.isOnList(on.entry)).toBe(true);
  });
});

describe('intents that leave the page', () => {
  const airTime = '2026-03-12T12:00:00Z';

  it('navigates to the entry"s own href', () => {
    const navigate = vi.fn();
    const bloc = loaded([show('a', [{ episodeNumber: 1, airTime }])], { navigate });

    bloc.open(bloc.entries[0]);

    expect(navigate).toHaveBeenCalledWith('/anime/a-slug');
  });

  it('adds by show id', () => {
    const add = vi.fn();
    const bloc = loaded([show('a', [{ episodeNumber: 1, airTime }])], { addAnime: { add } });

    bloc.addToList(bloc.entries[0]);

    expect(add).toHaveBeenCalledWith('a');
  });

  it('does nothing when the entry has no id to add', () => {
    const add = vi.fn();
    const bloc = loaded([show('a', [{ episodeNumber: 1, airTime }])], { addAnime: { add } });
    const entry = bloc.entries[0];
    entry.airingInfo.id = null;

    bloc.addToList(entry);

    expect(add).not.toHaveBeenCalled();
  });

  it('is a no-op rather than a crash when built outside a component', () => {
    // `createMutation` reads the QueryClient out of Svelte context, which does
    // not exist here; the fallback must not take the page down on first paint.
    const bloc = loaded([show('a', [{ episodeNumber: 1, airTime }])], { addAnime: undefined });

    expect(() => bloc.addToList(bloc.entries[0])).not.toThrow();
  });
});

describe('the shared clock', () => {
  it('names the season from the pinned clock', () => {
    expect(loaded([]).seasonLabel).toBe('Winter 2026');
    expect(makeBloc({ clock: () => new Date('2026-05-15T12:00:00Z') }).seasonLabel).toBe('Spring 2026');
  });

  it('reads the clock afresh on every read of `now`', () => {
    let now = NOW;
    const bloc = makeBloc({ clock: () => now });
    expect(bloc.now).toEqual(NOW);

    now = new Date('2026-03-11T18:00:00Z');
    expect(bloc.now).toEqual(now);
  });

  it('ticks every derived read forward together, on the interval', () => {
    // `#tick` is the reason `entries` is not stale forever: the clock itself is
    // not reactive, so without the tick a schedule left open overnight would
    // keep yesterday at the top.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let now = NOW;
    const bloc = loaded(
      [
        show('yesterday', [{ episodeNumber: 1, airTime: '2026-03-11T20:00:00Z' }]),
        show('tomorrow', [{ episodeNumber: 1, airTime: '2026-03-13T20:00:00Z' }]),
      ],
      { clock: () => now },
    );
    const stop = bloc.init();

    expect(bloc.scheduleDays.map((day) => day.id)).toEqual(['2026-03-11', '2026-03-13']);

    now = new Date('2026-03-12T12:00:00Z');
    vi.advanceTimersByTime(30_000);

    expect(bloc.scheduleDays.map((day) => day.id)).toEqual(['2026-03-13']);
    stop();
  });

  it('stops ticking once torn down', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let reads = 0;
    const bloc = loaded([show('a', [{ episodeNumber: 1, airTime: '2026-03-13T20:00:00Z' }])], {
      clock: () => {
        reads += 1;
        return NOW;
      },
    });

    const stop = bloc.init();
    vi.advanceTimersByTime(30_000);
    void bloc.scheduleDays;
    const afterOneTick = reads;

    stop();
    vi.advanceTimersByTime(30_000 * 10);
    void bloc.scheduleDays;

    expect(reads).toBe(afterOneTick);
  });
});
