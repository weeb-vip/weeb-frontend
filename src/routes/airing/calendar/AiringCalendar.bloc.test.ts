import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import {
  AiringCalendarBloc,
  type AiringCalendarDeps,
} from './AiringCalendar.bloc.svelte';
import type { AiringQueryPort } from '../CurrentlyAiringPage.bloc.svelte';
import type { AiringShow } from '../CurrentlyAiringPage.schedule';

/**
 * The `/airing/calendar` bloc.
 *
 * The bucketing rule itself (`groupShowsByDay`) and the day key it uses are
 * pinned in `CurrentlyAiringPage.schedule.test.ts`; none of that is repeated
 * here. What is pinned here is what the bloc owns: the visible range, the query
 * keyed to it, the loader payload's precedence over that query, and the paging
 * that moves both.
 *
 * The range, its fetch, and the per-day bucketing were three separate inline
 * reactive statements in the view, one of which built a whole new query on
 * every range change. Paging is therefore asserted end to end -- press
 * `next()`, and the range, the title, the cells and the data behind them all
 * have to move together.
 */

// `eachDayOfInterval` walks host-local days while the day key is computed in
// the chosen zone, so the host zone is part of this bloc's output. Pinned to
// UTC to make the cells exact.
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

/** Wednesday 11 March 2026. March opens on a Sunday and has 31 days. */
const NOW = new Date('2026-03-11T12:00:00Z');

type Ep = { episodeNumber: number; airTime?: string | null; airDate?: string | null };

function show(id: string, episodes: Ep[]): AiringShow {
  return { id, slug: `${id}-slug`, titleEn: id, duration: '24 min', episodes };
}

type Payload = { currentlyAiring?: AiringShow[] | null } | null | undefined;

/**
 * The airing query as a port keyed on the range it was asked for, so paging
 * cannot be served the previous month's cached page.
 */
function recordingAiring(handler: (start: Date) => Promise<Payload>) {
  const asked: { start: string; end: Date | null | undefined; days?: number; limit?: number }[] = [];
  const fetched: string[] = [];
  const port: AiringQueryPort = (start, end, days, limit) => {
    asked.push({ start: start.toISOString(), end, days, limit });
    return {
      queryKey: ['calendar', start.toISOString(), days ?? null, limit ?? null],
      queryFn: async () => {
        fetched.push(start.toISOString());
        return handler(start);
      },
    };
  };
  // The bloc rebuilds its options on every read of a query getter, so `asked`
  // fills up with the current range as a matter of course. `forget` draws the
  // line for an assertion that is only about what a prefetch asked for.
  return { port, asked, fetched, forget: () => asked.splice(0, asked.length) };
}

/**
 * A client of this test's own. `gcTime` stays generous because outside a
 * component the bloc's `fromStore` subscribes and unsubscribes on every read,
 * and a zero gcTime would evict the query between two reads.
 */
function inertClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

function makeBloc(deps: AiringCalendarDeps = {}) {
  return new AiringCalendarBloc({
    source: () => ({ ssrData: null, ssrError: null }),
    airing: () => ({
      queryKey: ['calendar', 'unused'],
      queryFn: async () => {
        throw new Error('the test did not expect a fetch');
      },
    }),
    queryClient: inertClient(),
    clock: () => NOW,
    localZone: () => 'Etc/UTC',
    ...deps,
  });
}

/** A bloc whose opening month is already filled in by the loader. */
function loaded(shows: AiringShow[], deps: AiringCalendarDeps = {}) {
  return makeBloc({
    source: () => ({ ssrData: { currentlyAiring: shows }, ssrError: null }),
    ...deps,
  });
}

const cellFor = (bloc: AiringCalendarBloc, iso: string) => bloc.cells.find((cell) => cell.iso === iso);
const busyCells = (bloc: AiringCalendarBloc) => bloc.cells.filter((cell) => cell.entries.length > 0);

describe('the visible range', () => {
  it('opens on the whole of the month the clock is in', () => {
    const bloc = loaded([]);

    expect(bloc.isMonthView).toBe(true);
    expect(bloc.title).toBe('March 2026');
    expect(bloc.rangeStart.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(bloc.rangeEnd.toISOString()).toBe('2026-03-31T23:59:59.999Z');
    expect(bloc.cells).toHaveLength(31);
  });

  it('labels each cell with its own day number and weekday', () => {
    const bloc = loaded([]);

    expect(bloc.cells[0].dayNumber).toBe('1');
    expect(bloc.cells[0].weekdayShort).toBe('Sun');
    expect(bloc.cells.at(-1)!.dayNumber).toBe('31');
  });

  it('narrows to a Sunday-to-Saturday week', () => {
    const bloc = loaded([]);
    bloc.selectViewMode('week');

    expect(bloc.isMonthView).toBe(false);
    expect(bloc.viewMode).toBe('week');
    expect(bloc.cells).toHaveLength(7);
    expect(bloc.cells[0].weekdayShort).toBe('Sun');
    expect(bloc.rangeStart.toISOString()).toBe('2026-03-08T00:00:00.000Z');
    expect(bloc.rangeEnd.toISOString()).toBe('2026-03-14T23:59:59.999Z');
  });

  it('titles a week by the day it starts on', () => {
    const bloc = loaded([]);
    bloc.selectViewMode('week');

    expect(bloc.title).toBe('Week of Mar 8');
  });

  it('treats anything that is not "week" as the month view', () => {
    // The value comes off a segmented control; an unrecognised one must not
    // leave the page rendering neither range.
    const bloc = loaded([]);
    bloc.selectViewMode('week');
    bloc.selectViewMode('nonsense');

    expect(bloc.viewMode).toBe('month');
    expect(bloc.cells).toHaveLength(31);
  });

  it('reserves a month-sized skeleton for a month and a week-sized one for a week', () => {
    const bloc = loaded([]);
    expect(bloc.skeletonCellCount).toBe(35);

    bloc.selectViewMode('week');
    expect(bloc.skeletonCellCount).toBe(7);
  });
});

describe('paging the range', () => {
  it('moves a month forward and back', () => {
    const bloc = loaded([]);

    bloc.next();
    expect(bloc.title).toBe('April 2026');
    expect(bloc.rangeStart.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(bloc.cells).toHaveLength(30);

    bloc.previous();
    expect(bloc.title).toBe('March 2026');
    expect(bloc.cells).toHaveLength(31);
  });

  it('rolls back over the year boundary', () => {
    const bloc = makeBloc({ clock: () => new Date('2026-01-15T12:00:00Z') });
    bloc.previous();

    expect(bloc.title).toBe('December 2025');
    expect(bloc.rangeStart.toISOString()).toBe('2025-12-01T00:00:00.000Z');
  });

  it('rolls forward over the year boundary', () => {
    const bloc = makeBloc({ clock: () => new Date('2026-12-15T12:00:00Z') });
    bloc.next();

    expect(bloc.title).toBe('January 2027');
    expect(bloc.rangeStart.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('moves a week at a time while in the week view', () => {
    const bloc = loaded([]);
    bloc.selectViewMode('week');

    bloc.next();
    expect(bloc.title).toBe('Week of Mar 15');

    bloc.previous();
    bloc.previous();
    expect(bloc.title).toBe('Week of Mar 1');
  });

  it('carries a week across the year boundary', () => {
    const bloc = makeBloc({ clock: () => new Date('2026-12-31T12:00:00Z') });
    bloc.selectViewMode('week');
    expect(bloc.title).toBe('Week of Dec 27');

    bloc.next();
    expect(bloc.rangeStart.toISOString()).toBe('2027-01-03T00:00:00.000Z');
  });

  it('re-keys the one query instead of building a new one per range', async () => {
    const airing = recordingAiring(async () => ({ currentlyAiring: [] }));
    const bloc = makeBloc({ airing: airing.port });

    void bloc.cells;
    bloc.next();
    await vi.waitFor(() => expect(airing.fetched).toContain('2026-04-01T00:00:00.000Z'));

    expect(airing.fetched).toEqual(['2026-03-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z']);
  });

  it('asks for a fixed 32-day window and a page of 300', () => {
    const airing = recordingAiring(async () => null);
    const bloc = makeBloc({ airing: airing.port });

    void bloc.cells;

    expect(airing.asked[0].end).toBeNull();
    expect(airing.asked[0].days).toBe(32);
    expect(airing.asked[0].limit).toBe(300);
  });
});

describe('the loader payload and the query', () => {
  const marchShow = show('ssr', [{ episodeNumber: 1, airTime: '2026-03-12T12:00:00Z' }]);

  it('paints the opening month from the loader without a request', async () => {
    const airing = recordingAiring(async () => ({ currentlyAiring: [] }));
    const bloc = loaded([marchShow], { airing: airing.port });

    expect(bloc.isLoading).toBe(false);
    expect(cellFor(bloc, '2026-03-12')!.entries.map((entry) => entry.id)).toEqual(['ssr']);

    await Promise.resolve();
    expect(airing.fetched).toEqual([]);
  });

  it('knows the loader payload only covers the month the page opened on', () => {
    const bloc = loaded([marchShow]);
    expect(bloc.isDefaultMonth).toBe(true);

    bloc.next();
    expect(bloc.isDefaultMonth).toBe(false);

    bloc.previous();
    expect(bloc.isDefaultMonth).toBe(true);
  });

  it('is not the default month in the week view, however short the range', () => {
    // The loader fetched a month; a week is a different query and must not be
    // seeded with it.
    const bloc = loaded([marchShow]);
    bloc.selectViewMode('week');

    expect(bloc.isDefaultMonth).toBe(false);
  });

  it('does not reuse the loader payload for a month it never covered', async () => {
    const aprilShow = show('fetched', [{ episodeNumber: 1, airTime: '2026-04-10T12:00:00Z' }]);
    const bloc = loaded([show('ssr', [{ episodeNumber: 1, airTime: '2026-04-10T12:00:00Z' }])], {
      airing: recordingAiring(async () => ({ currentlyAiring: [aprilShow] })).port,
    });

    bloc.next();

    await vi.waitFor(() =>
      expect(cellFor(bloc, '2026-04-10')!.entries.map((entry) => entry.id)).toEqual(['fetched']),
    );
    expect(busyCells(bloc)).toHaveLength(1);
  });

  it('reports the loader"s own failure', () => {
    const bloc = makeBloc({ source: () => ({ ssrData: null, ssrError: 'the loader gave up' }) });

    expect(bloc.ssrError).toBe('the loader gave up');
    expect(bloc.errorDetail).toBe('the loader gave up');
  });

  it('has no error detail when neither the loader nor the query failed', () => {
    expect(loaded([]).errorDetail).toBe('');
    expect(loaded([]).ssrError).toBeNull();
  });
});

describe('loading, empty and failed states', () => {
  it('is loading while the first fetch is in flight, with an empty grid', () => {
    const bloc = makeBloc({
      airing: () => ({ queryKey: ['calendar', 'pending'], queryFn: () => new Promise<Payload>(() => {}) }),
    });

    expect(bloc.isLoading).toBe(true);
    expect(bloc.isRetrying).toBe(true);
    expect(bloc.isEmpty).toBe(true);
    expect(bloc.cells).toHaveLength(31);
  });

  it('is empty, not broken, for a null payload', async () => {
    const bloc = makeBloc({
      airing: () => ({ queryKey: ['calendar', 'null'], queryFn: async () => null }),
    });

    await vi.waitFor(() => expect(bloc.isLoading).toBe(false));
    expect(bloc.isEmpty).toBe(true);
    expect(bloc.isError).toBe(false);
  });

  it('is empty when nothing is airing at all', () => {
    expect(loaded([]).isEmpty).toBe(true);
  });

  it('is empty when a show carries no episodes', () => {
    expect(loaded([show('a', [])]).isEmpty).toBe(true);
  });

  it('skips an episode with no air date and keeps the rest', () => {
    const bloc = loaded([
      show('a', [{ episodeNumber: 1 }, { episodeNumber: 2, airTime: '2026-03-12T12:00:00Z' }]),
    ]);

    expect(busyCells(bloc)).toHaveLength(1);
    expect(cellFor(bloc, '2026-03-12')!.entries).toHaveLength(1);
  });

  it('is not empty merely because most days are quiet', () => {
    const bloc = loaded([show('a', [{ episodeNumber: 1, airTime: '2026-03-12T12:00:00Z' }])]);

    expect(bloc.isEmpty).toBe(false);
    expect(bloc.cells.filter((cell) => cell.entries.length === 0)).toHaveLength(30);
  });

  it('surfaces a failed refresh without blanking what is on screen', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { bloc } = failingRefetch(() => {
      throw new Error('upstream exploded');
    });

    bloc.retry();

    await vi.waitFor(() => expect(bloc.isError).toBe(true));
    expect(bloc.errorDetail).toBe('upstream exploded');
    expect(busyCells(bloc)).toHaveLength(1);
    expect(logged).not.toHaveBeenCalled();
    logged.mockRestore();
  });

  it('prefers the query"s message over the loader"s stale one', async () => {
    const { bloc } = failingRefetch(
      () => {
        throw new Error('the refresh failed');
      },
      'the loader failed',
    );

    bloc.retry();

    await vi.waitFor(() => expect(bloc.isError).toBe(true));
    expect(bloc.errorDetail).toBe('the refresh failed');
  });

  it('falls back to the loader"s message when the rejection carries none', async () => {
    const { bloc } = failingRefetch(() => {
      throw 'no message on this one';
    }, 'the loader failed');

    bloc.retry();

    await vi.waitFor(() => expect(bloc.isError).toBe(true));
    expect(bloc.errorDetail).toBe('the loader failed');
  });

  it('asks again, and recovers, when retry is pressed', async () => {
    const { bloc, attempts } = failingRefetch(
      () => {
        throw new Error('first try');
      },
      null,
      { currentlyAiring: [show('recovered', [{ episodeNumber: 1, airTime: '2026-03-20T12:00:00Z' }])] },
    );

    bloc.retry();
    await vi.waitFor(() => expect(bloc.isError).toBe(true));

    bloc.retry();
    await vi.waitFor(() => expect(bloc.isError).toBe(false));

    expect(attempts()).toBe(2);
    expect(cellFor(bloc, '2026-03-20')!.entries.map((entry) => entry.id)).toEqual(['recovered']);
  });
});

/**
 * A seeded bloc whose next fetch blows up.
 *
 * The failure is reached through `retry()` rather than a cold load on purpose:
 * outside a component the bloc's `fromStore` has no effect to track, so each
 * getter read mounts and unmounts an observer, and a query with no data
 * re-fetches on every one of those mounts -- resetting the error before it can
 * be read. Seeding the loader payload makes the query's `refetchOnMount: false`
 * apply, so the error settles. It is also the realistic case: an SSR'd calendar
 * whose background refresh fails.
 */
function failingRefetch(fail: () => never, ssrError: string | null = null, recovery?: Payload) {
  let attempt = 0;
  const bloc = new AiringCalendarBloc({
    source: () => ({
      ssrData: { currentlyAiring: [show('seeded', [{ episodeNumber: 1, airTime: '2026-03-12T12:00:00Z' }])] },
      ssrError,
    }),
    airing: () => ({
      queryKey: ['calendar', 'failing'],
      queryFn: async () => {
        attempt += 1;
        if (attempt === 1) fail();
        return recovery ?? null;
      },
    }),
    queryClient: inertClient(),
    clock: () => NOW,
    localZone: () => 'Etc/UTC',
  });
  return { bloc, attempts: () => attempt };
}

describe('what lands on a day cell', () => {
  it('attaches each episode to the day it airs on', () => {
    const bloc = loaded([
      show('a', [{ episodeNumber: 1, airTime: '2026-03-12T12:00:00Z' }]),
      show('b', [{ episodeNumber: 1, airTime: '2026-03-20T12:00:00Z' }]),
    ]);

    expect(busyCells(bloc).map((cell) => cell.iso)).toEqual(['2026-03-12', '2026-03-20']);
  });

  it('orders a day"s shows by the time they air', () => {
    const bloc = loaded([
      show('late', [{ episodeNumber: 1, airTime: '2026-03-12T22:00:00Z' }]),
      show('early', [{ episodeNumber: 1, airTime: '2026-03-12T04:00:00Z' }]),
    ]);

    expect(cellFor(bloc, '2026-03-12')!.entries.map((entry) => entry.id)).toEqual(['early', 'late']);
  });

  it('gives a show airing twice in the month a row on each day', () => {
    const bloc = loaded([
      show('weekly', [
        { episodeNumber: 1, airTime: '2026-03-05T12:00:00Z' },
        { episodeNumber: 2, airTime: '2026-03-12T12:00:00Z' },
      ]),
    ]);

    expect(busyCells(bloc)).toHaveLength(2);
    // Each row carries only the episode it is a row for, because that is what
    // the popover renders.
    expect(cellFor(bloc, '2026-03-12')!.entries[0].episodes).toHaveLength(1);
  });

  it('carries the resolved air time onto the row', () => {
    const bloc = loaded([show('a', [{ episodeNumber: 1, airTime: '2026-03-12T12:00:00Z' }])]);

    expect(cellFor(bloc, '2026-03-12')!.entries[0].episodeAirTime.toISOString()).toBe(
      '2026-03-12T12:00:00.000Z',
    );
  });

  it('leaves episodes outside the range off the grid entirely', () => {
    const bloc = loaded([show('april', [{ episodeNumber: 1, airTime: '2026-04-12T12:00:00Z' }])]);

    expect(busyCells(bloc)).toHaveLength(0);
    expect(bloc.isEmpty).toBe(true);
  });

  it('marks exactly one cell as today', () => {
    const bloc = loaded([]);

    expect(bloc.cells.filter((cell) => cell.isToday).map((cell) => cell.iso)).toEqual([
      '2026-03-11',
    ]);
  });

  it('marks no cell as today in a month that is not this one', () => {
    const bloc = loaded([]);
    bloc.next();

    expect(bloc.cells.some((cell) => cell.isToday)).toBe(false);
  });
});

describe('the zone decides where a day starts', () => {
  /** 00:30 on 13 March in Tokyo; 10:30 on the 12th five hours behind UTC. */
  const LATE_NIGHT_JST = '2026-03-12T15:30:00Z';

  function zoned(zone: string) {
    return loaded([show('late', [{ episodeNumber: 1, airTime: LATE_NIGHT_JST }])], {
      localZone: () => zone,
    });
  }

  it('buckets a late-night Tokyo episode onto the Japanese day', () => {
    expect(busyCells(zoned('Asia/Tokyo')).map((cell) => cell.iso)).toEqual(['2026-03-13']);
  });

  it('buckets the same instant onto the previous day further west', () => {
    // Same episode, same data, different zone: the day key has to move.
    expect(busyCells(zoned('Etc/GMT+5')).map((cell) => cell.iso)).toEqual(['2026-03-12']);
  });

  it('moves which cell counts as today', () => {
    const lateInTheDay = new Date('2026-03-11T23:00:00Z');
    const utc = makeBloc({ clock: () => lateInTheDay, localZone: () => 'Etc/UTC' });
    const tokyo = makeBloc({ clock: () => lateInTheDay, localZone: () => 'Asia/Tokyo' });

    expect(utc.cells.find((cell) => cell.isToday)?.iso).toBe('2026-03-11');
    expect(tokyo.cells.find((cell) => cell.isToday)?.iso).toBe('2026-03-12');
  });

  it('offsets every cell key by a day for a zone behind the host', () => {
    // Current behaviour, and a latent bug: the grid walks *host-local* days but
    // keys each cell in the chosen zone, so for any zone behind the host every
    // cell's `iso` is a day earlier than the `dayNumber` printed on it. In the
    // app the two are always the same zone (`browserLocalZone`), which is the
    // only reason this has never shown. Pinned so a second caller passing a
    // different zone is not a silent off-by-one.
    const bloc = zoned('Etc/GMT+5');

    expect(bloc.cells[0].dayNumber).toBe('1');
    expect(bloc.cells[0].iso).toBe('2026-02-28');
  });

  it('lines the two up when the zone is the host"s own', () => {
    const bloc = zoned('Etc/UTC');

    expect(bloc.cells[0].dayNumber).toBe('1');
    expect(bloc.cells[0].iso).toBe('2026-03-01');
  });
});

describe('warming the neighbouring ranges', () => {
  it('prefetches the month either side, but only after the first paint', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const airing = recordingAiring(async () => ({ currentlyAiring: [] }));
    const bloc = makeBloc({ airing: airing.port });
    airing.forget();

    const stop = bloc.init();
    expect(airing.asked.map((call) => call.start)).toEqual([]);

    vi.advanceTimersByTime(1000);

    // Prefetching all three ranges at once is what made the first one slow.
    expect(airing.asked.map((call) => call.start).sort()).toEqual([
      '2026-02-01T00:00:00.000Z',
      '2026-04-01T00:00:00.000Z',
    ]);
    stop();
  });

  it('honours a caller-supplied delay', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const airing = recordingAiring(async () => null);
    const bloc = makeBloc({ airing: airing.port });
    airing.forget();

    const stop = bloc.init(5000);
    vi.advanceTimersByTime(4999);
    expect(airing.asked).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(airing.asked).toHaveLength(2);
    stop();
  });

  it('warms nothing once torn down before the delay elapses', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const airing = recordingAiring(async () => null);
    const bloc = makeBloc({ airing: airing.port });
    airing.forget();

    bloc.init()();
    vi.advanceTimersByTime(10_000);

    expect(airing.asked).toEqual([]);
  });

  it('warms the weeks either side while in the week view', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const airing = recordingAiring(async () => null);
    const bloc = makeBloc({ airing: airing.port });
    bloc.selectViewMode('week');
    airing.forget();

    const stop = bloc.init();
    vi.advanceTimersByTime(1000);

    expect(airing.asked.map((call) => call.start).sort()).toEqual([
      '2026-03-01T00:00:00.000Z',
      '2026-03-15T00:00:00.000Z',
    ]);
    stop();
  });
});
