import { describe, it, expect } from 'vitest';
import { writable, fromStore } from 'svelte/store';
import {
  SeriesPageBloc,
  entrySubtitle,
  groupBySeason,
  pickAnchor,
  seriesSummary,
  seriesYears,
  type SeriesEntry
} from './SeriesPage.bloc.svelte';

/**
 * A series page: every anime sharing a TheTVDB series id, laid out season by
 * season.
 *
 * The rules that matter here are the ones the markup used to get wrong. The
 * three buckets are not interchangeable -- numbered seasons are the run,
 * season 0 is TheTVDB's specials, and everything with no derived season is the
 * honest remainder that a page which quietly dropped it would misreport as a
 * smaller series. The summary line is assembled in one place because inline
 * `{#if}` blocks swallowed the spaces around them. And the entries the loader
 * sent are read through an accessor on every read, so a navigation from one
 * series id to another cannot leave the previous series' groups on screen.
 */

function entry(id: string, extra: Partial<SeriesEntry> = {}): SeriesEntry {
  return { id, titleEn: `${id} EN`, titleJp: `${id} JP`, ...extra };
}

/** The bloc over a payload that can be replaced, as a param change replaces it. */
function overMutablePayload(initial: {
  entries: SeriesEntry[];
  seriesTitle?: string;
  ssrError?: string | null;
}) {
  const store = writable({
    entries: initial.entries,
    seriesTitle: initial.seriesTitle ?? 'Series',
    ssrError: initial.ssrError ?? null
  });
  const view = fromStore(store);
  const bloc = new SeriesPageBloc({
    source: () => view.current,
    preferences: writable({ titleLanguage: 'english' as const })
  });
  return { bloc, setPayload: store.set };
}

function build(
  entries: SeriesEntry[],
  {
    seriesTitle = 'Series',
    ssrError = null,
    titleLanguage = 'english'
  }: { seriesTitle?: string; ssrError?: string | null; titleLanguage?: 'english' | 'japanese' } = {}
) {
  return new SeriesPageBloc({
    source: () => ({ entries, seriesTitle, ssrError }),
    preferences: writable({ titleLanguage })
  });
}

describe('grouping a series by season', () => {
  it('puts the numbered seasons in order', () => {
    const groups = groupBySeason([
      entry('c', { seasonNumber: 3 }),
      entry('a', { seasonNumber: 1 }),
      entry('b', { seasonNumber: 2 })
    ]);

    expect(groups.map((group) => group.key)).toEqual(['s1', 's2', 's3']);
    expect(groups.map((group) => group.heading)).toEqual(['Season 1', 'Season 2', 'Season 3']);
  });

  it('orders the entries inside a season the way they are watched', () => {
    const groups = groupBySeason([
      entry('later', { seasonNumber: 1, startDate: '2016-10-01T00:00:00Z' }),
      entry('first', { seasonNumber: 1, startDate: '2016-04-01T00:00:00Z' })
    ]);

    expect(groups[0].items.map((item) => item.id)).toEqual(['first', 'later']);
  });

  it('leaves an undated entry at the end of its season rather than at the front', () => {
    // `new Date(null)` is the epoch, so an undated entry sorted first and the
    // season looked like it began with something that had never aired.
    const groups = groupBySeason([
      entry('undated', { seasonNumber: 1, startDate: null }),
      entry('dated', { seasonNumber: 1, startDate: '2016-04-01T00:00:00Z' })
    ]);

    expect(groups[0].items.map((item) => item.id)).toEqual(['dated', 'undated']);
  });

  it('files season zero as specials, not as a season of the show', () => {
    const groups = groupBySeason([
      entry('ova', { seasonNumber: 0 }),
      entry('s1', { seasonNumber: 1 })
    ]);

    expect(groups.map((group) => group.key)).toEqual(['s1', 'specials']);
    expect(groups[1].heading).toBe('Specials');
  });

  it('keeps the entries no season could be derived for', () => {
    // Most of the catalogue has no derived season. Dropping them would claim a
    // series is smaller than it is.
    const groups = groupBySeason([
      entry('film', { seasonNumber: null }),
      entry('short'),
      entry('s1', { seasonNumber: 1 })
    ]);

    expect(groups.map((group) => group.key)).toEqual(['s1', 'other']);
    expect(groups[1].heading).toBe('Other entries');
    expect(groups[1].items.map((item) => item.id)).toEqual(['film', 'short']);
  });

  it('puts the specials and the remainder after the run, in that order', () => {
    const groups = groupBySeason([
      entry('other'),
      entry('special', { seasonNumber: 0 }),
      entry('s2', { seasonNumber: 2 }),
      entry('s1', { seasonNumber: 1 })
    ]);

    expect(groups.map((group) => group.key)).toEqual(['s1', 's2', 'specials', 'other']);
  });

  it('offers no empty buckets', () => {
    expect(groupBySeason([entry('s1', { seasonNumber: 1 })]).map((group) => group.key)).toEqual([
      's1'
    ]);
    expect(groupBySeason([])).toEqual([]);
  });

  it('gives each group a key `{#each}` can rely on', () => {
    const groups = groupBySeason([
      entry('a', { seasonNumber: 1 }),
      entry('b', { seasonNumber: 2 }),
      entry('c', { seasonNumber: 0 }),
      entry('d')
    ]);
    const keys = groups.map((group) => group.key);

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('the years a series covers', () => {
  it('is one year when everything landed in it', () => {
    // Not "2016 – 2016".
    expect(
      seriesYears([
        entry('a', { startDate: '2016-04-01T00:00:00Z' }),
        entry('b', { startDate: '2016-10-01T00:00:00Z' })
      ])
    ).toBe('2016');
  });

  it('is the span from the first to the last', () => {
    expect(
      seriesYears([
        entry('b', { startDate: '2019-01-01T00:00:00Z' }),
        entry('a', { startDate: '2013-04-01T00:00:00Z' })
      ])
    ).toBe('2013 – 2019');
  });

  it('ignores the entries with no usable date', () => {
    expect(
      seriesYears([entry('a', { startDate: null }), entry('b', { startDate: '2021-01-01T00:00:00Z' })])
    ).toBe('2021');
  });

  it('is empty when nothing can be dated', () => {
    expect(seriesYears([entry('a', { startDate: null })])).toBe('');
    expect(seriesYears([])).toBe('');
  });
});

describe('the summary line', () => {
  it('keeps the spaces the inline markup used to swallow', () => {
    // The bug this replaces rendered "13 entriesacross 5 seasons".
    expect(seriesSummary(13, 5, '2013 – 2023')).toBe('13 entries across 5 seasons · 2013 – 2023');
  });

  it('speaks of one entry and one season in the singular', () => {
    expect(seriesSummary(1, 1, '2016')).toBe('1 entry across 1 season · 2016');
  });

  it('drops the season clause when nothing is grouped into one', () => {
    expect(seriesSummary(3, 0, '2016')).toBe('3 entries · 2016');
  });

  it('drops the years when none are known', () => {
    expect(seriesSummary(3, 1, '')).toBe('3 entries across 1 season');
  });

  it('still says something for a series with nothing in it', () => {
    expect(seriesSummary(0, 0, '')).toBe('0 entries');
  });
});

describe('the entry whose art stands for the series', () => {
  it('is the earliest TV run, which is also the one that names the series', () => {
    const anchor = pickAnchor([
      entry('movie', { type: 'Movie', startDate: '2012-01-01T00:00:00Z' }),
      entry('tv2', { type: 'TV', startDate: '2018-01-01T00:00:00Z' }),
      entry('tv1', { type: 'TV', startDate: '2015-01-01T00:00:00Z' })
    ]);

    expect(anchor?.id).toBe('tv1');
  });

  it('matches the type case-insensitively, as the API writes it', () => {
    expect(pickAnchor([entry('a', { type: 'tv', startDate: '2015-01-01T00:00:00Z' })])?.id).toBe(
      'a'
    );
  });

  it('falls back to the earliest of anything for a series that never aired on TV', () => {
    const anchor = pickAnchor([
      entry('ova', { type: 'OVA', startDate: '2014-01-01T00:00:00Z' }),
      entry('movie', { type: 'Movie', startDate: '2011-01-01T00:00:00Z' })
    ]);

    expect(anchor?.id).toBe('movie');
  });

  it('has nothing to pick from an empty series', () => {
    expect(pickAnchor([])).toBeUndefined();
  });

  it('does not reorder the list it was handed', () => {
    const entries = [
      entry('late', { startDate: '2020-01-01T00:00:00Z' }),
      entry('early', { startDate: '2010-01-01T00:00:00Z' })
    ];

    pickAnchor(entries);

    expect(entries.map((item) => item.id)).toEqual(['late', 'early']);
  });
});

describe('the line under a card', () => {
  it('is the year and the kind of entry', () => {
    expect(entrySubtitle(entry('a', { startDate: '2016-04-01T00:00:00Z', type: 'TV' }))).toBe(
      '2016 · TV'
    );
  });

  it('joins only the parts that exist', () => {
    expect(entrySubtitle(entry('a', { startDate: '2016-04-01T00:00:00Z', type: null }))).toBe(
      '2016'
    );
    expect(entrySubtitle(entry('a', { startDate: null, type: 'Movie' }))).toBe('TBA · Movie');
  });
});

describe('the bloc over a loaded series', () => {
  const series = [
    entry('s1', { seasonNumber: 1, type: 'TV', startDate: '2013-04-01T00:00:00Z' }),
    entry('s2', { seasonNumber: 2, type: 'TV', startDate: '2017-04-01T00:00:00Z' }),
    entry('film', { type: 'Movie', startDate: '2015-01-01T00:00:00Z' })
  ];

  it('reports the title and the loader’s failure verbatim', () => {
    const bloc = build(series, { seriesTitle: 'Attack on Titan', ssrError: 'GraphQL: boom' });

    expect(bloc.seriesTitle).toBe('Attack on Titan');
    expect(bloc.ssrError).toBe('GraphQL: boom');
  });

  it('has no error to report for a series that loaded', () => {
    expect(build(series).ssrError).toBeNull();
  });

  it('groups what the loader sent', () => {
    expect(build(series).groups.map((group) => group.key)).toEqual(['s1', 's2', 'other']);
  });

  it('summarises the run, the seasons and the years together', () => {
    expect(build(series).summary).toBe('3 entries across 2 seasons · 2013 – 2017');
  });

  it('anchors the page on the first TV season', () => {
    expect(build(series).anchorImageId).toBe('s1');
  });

  it('has no anchor for a series with no entries', () => {
    expect(build([]).anchorImageId).toBeUndefined();
  });
});

describe('a season shown in two cours', () => {
  it('is listed once, as the one season it is', () => {
    // MyAnimeList files each broadcast run separately; TheTVDB keeps them under
    // one season, and that is the signal the bloc collapses on.
    const bloc = build([
      entry('part1', { seasonNumber: 3, type: 'TV', startDate: '2018-07-01T00:00:00Z' }),
      entry('part2', { seasonNumber: 3, type: 'TV', startDate: '2019-04-01T00:00:00Z' })
    ]);

    expect(bloc.groups).toHaveLength(1);
    expect(bloc.groups[0].items.map((item) => item.id)).toEqual(['part1']);
  });

  it('is counted once in the summary too', () => {
    const bloc = build([
      entry('part1', { seasonNumber: 3, type: 'TV', startDate: '2018-07-01T00:00:00Z' }),
      entry('part2', { seasonNumber: 3, type: 'TV', startDate: '2019-04-01T00:00:00Z' })
    ]);

    expect(bloc.summary).toBe('1 entry across 1 season · 2018');
  });

  it('does not collapse a season whose entries are not all TV runs', () => {
    const bloc = build([
      entry('tv', { seasonNumber: 3, type: 'TV', startDate: '2018-07-01T00:00:00Z' }),
      entry('ova', { seasonNumber: 3, type: 'OVA', startDate: '2019-04-01T00:00:00Z' })
    ]);

    expect(bloc.groups[0].items.map((item) => item.id)).toEqual(['tv', 'ova']);
  });
});

describe('counting the seasons', () => {
  it('counts the numbered seasons', () => {
    const bloc = build([
      entry('a', { seasonNumber: 1 }),
      entry('b', { seasonNumber: 2 }),
      entry('c')
    ]);

    expect(bloc.seasonCount).toBe(2);
  });

  it('counts the specials bucket as a season as well', () => {
    // Current behaviour, and it is wrong: `seasonCount` filters on
    // `key.startsWith('s')`, which the "specials" key also satisfies. A series
    // with one season and an OVA reports two seasons, in the summary line too.
    const bloc = build([entry('a', { seasonNumber: 1 }), entry('ova', { seasonNumber: 0 })]);

    expect(bloc.groups.map((group) => group.key)).toEqual(['s1', 'specials']);
    expect(bloc.seasonCount).toBe(2);
    expect(bloc.summary).toBe('2 entries across 2 seasons');
  });

  it('does not count the remainder bucket', () => {
    const bloc = build([entry('film'), entry('short')]);

    expect(bloc.seasonCount).toBe(0);
    expect(bloc.summary).toBe('2 entries');
  });
});

describe('a navigation to another series', () => {
  it('does not leave the previous series’ entries on the page', () => {
    // SvelteKit reuses one +page.svelte across a param change, and the bloc is
    // built once. Everything derived has to come back through the accessor, or
    // /series/2 renders /series/1.
    const { bloc, setPayload } = overMutablePayload({
      entries: [entry('a', { seasonNumber: 1, startDate: '2013-04-01T00:00:00Z' })],
      seriesTitle: 'First'
    });

    expect(bloc.groups[0].items.map((item) => item.id)).toEqual(['a']);

    setPayload({
      entries: [
        entry('x', { seasonNumber: 1, startDate: '2020-04-01T00:00:00Z' }),
        entry('y', { seasonNumber: 2, startDate: '2022-04-01T00:00:00Z' })
      ],
      seriesTitle: 'Second',
      ssrError: null
    });

    expect(bloc.seriesTitle).toBe('Second');
    expect(bloc.groups.map((group) => group.key)).toEqual(['s1', 's2']);
    expect(bloc.groups.flatMap((group) => group.items.map((item) => item.id))).toEqual(['x', 'y']);
    expect(bloc.summary).toBe('2 entries across 2 seasons · 2020 – 2022');
    expect(bloc.anchorImageId).toBe('x');
  });

  it('clears a stale error when the next series loads cleanly', () => {
    const { bloc, setPayload } = overMutablePayload({ entries: [], ssrError: 'GraphQL: boom' });

    expect(bloc.ssrError).toBe('GraphQL: boom');

    setPayload({ entries: [entry('a')], seriesTitle: 'Second', ssrError: null });

    expect(bloc.ssrError).toBeNull();
  });
});

describe('titles on the cards', () => {
  it('follows the reader’s language', () => {
    const card = entry('a', { titleEn: 'Frieren', titleJp: 'Sousou no Frieren' });

    expect(build([], { titleLanguage: 'english' }).titleFor(card)).toBe('Frieren');
    expect(build([], { titleLanguage: 'japanese' }).titleFor(card)).toBe('Sousou no Frieren');
  });

  it('follows a change of language under the page', () => {
    const preferences = writable({ titleLanguage: 'english' as 'english' | 'japanese' });
    const bloc = new SeriesPageBloc({
      source: () => ({ entries: [], seriesTitle: 'Series', ssrError: null }),
      preferences
    });
    const card = entry('a', { titleEn: 'Frieren', titleJp: 'Sousou no Frieren' });

    expect(bloc.titleFor(card)).toBe('Frieren');

    preferences.set({ titleLanguage: 'japanese' });

    expect(bloc.titleFor(card)).toBe('Sousou no Frieren');
  });

  it('falls back to the other language rather than printing nothing', () => {
    expect(build([], { titleLanguage: 'japanese' }).titleFor(entry('a', { titleJp: null }))).toBe(
      'a EN'
    );
  });

  it('delegates the card’s second line to the shared rule', () => {
    expect(
      build([]).subtitleFor(entry('a', { startDate: '2016-04-01T00:00:00Z', type: 'TV' }))
    ).toBe('2016 · TV');
  });
});

describe('empty and missing payloads', () => {
  it('renders an empty series rather than throwing', () => {
    const bloc = build([]);

    expect(bloc.groups).toEqual([]);
    expect(bloc.seasonCount).toBe(0);
    expect(bloc.summary).toBe('0 entries');
    expect(bloc.anchorImageId).toBeUndefined();
  });

  it('treats a missing entry list as an empty one', () => {
    const bloc = new SeriesPageBloc({
      source: () =>
        ({ entries: undefined, seriesTitle: 'Series', ssrError: null }) as unknown as {
          entries: SeriesEntry[];
          seriesTitle: string;
          ssrError: string | null;
        },
      preferences: writable({ titleLanguage: 'english' as const })
    });

    expect(bloc.groups).toEqual([]);
    expect(bloc.summary).toBe('0 entries');
  });

  it('starts from an empty series when constructed with no ports at all', () => {
    const bloc = new SeriesPageBloc();

    expect(bloc.seriesTitle).toBe('Series');
    expect(bloc.ssrError).toBeNull();
    expect(bloc.groups).toEqual([]);
  });
});
