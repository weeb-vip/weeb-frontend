import { describe, it, expect } from 'vitest';
import { entryHref, isMainEntry, relatedGroups } from './RelatedAnime.logic';

/** An anime as the related rail sees it. */
const anime = (
  id: string,
  extra: Partial<{ startDate: string | null; seasonNumber: number | null; type: string }> = {}
) => ({ id, titleEn: id, startDate: null, seasonNumber: null, type: 'TV', ...extra });

const related = (relation: string | null, a: ReturnType<typeof anime>) => ({ relation, anime: a });

const titles = (groups: ReturnType<typeof relatedGroups>) =>
  groups.map((g) => ({ heading: g.heading, ids: g.items.map((i: { id: string }) => i.id) }));

describe('relatedGroups', () => {
  it('has no shelves at all without entries', () => {
    expect(relatedGroups([], null)).toEqual([]);
  });

  it('skips entries the API sent with no anime attached', () => {
    const groups = relatedGroups(
      [{ relation: 'SAME_SERIES', anime: null }, related('SAME_SERIES', anime('a'))],
      null
    );

    expect(groups[0].items).toHaveLength(1);
  });

  it('names the same-series shelf for what it is', () => {
    const groups = relatedGroups([related('SAME_SERIES', anime('a'))], null);

    // Entries in the same series are not "related" -- they are this anime in
    // another form.
    expect(groups[0].heading).toBe('Same series');
    expect(groups[0].kind).toBe('SAME_SERIES');
  });

  it('keeps a kind it has no heading for rather than dropping the data', () => {
    const groups = relatedGroups([related('SPIN_OFF', anime('a'))], null);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('SPIN_OFF');
    expect(groups[0].heading).toBe('Related');
  });

  it('keeps an entry the API sent with no relation at all', () => {
    const groups = relatedGroups([related(null, anime('a'))], null);

    expect(groups[0].heading).toBe('Related');
  });

  it('puts the same-series shelf first, whatever order the API sent', () => {
    const groups = relatedGroups(
      [related('SPIN_OFF', anime('s')), related('SAME_SERIES', anime('a'))],
      null
    );

    expect(groups.map((g) => g.kind)).toEqual(['SAME_SERIES', 'SPIN_OFF']);
  });

  it('orders a shelf by air date, undated last', () => {
    const groups = relatedGroups(
      [
        related('SAME_SERIES', anime('third', { startDate: '2020-01-01' })),
        related('SAME_SERIES', anime('undated')),
        related('SAME_SERIES', anime('first', { startDate: '1998-01-01' }))
      ],
      null
    );

    // An unaired special must not open the history of a series that began in 1998.
    expect(titles(groups)[0].ids).toEqual(['first', 'third', 'undated']);
  });

  it('places the anime being viewed into its own series timeline', () => {
    const current = anime('current', { startDate: '2005-01-01' });
    const groups = relatedGroups(
      [
        related('SAME_SERIES', anime('older', { startDate: '2000-01-01' })),
        related('SAME_SERIES', anime('newer', { startDate: '2010-01-01' }))
      ],
      current
    );

    expect(titles(groups)[0].ids).toEqual(['older', 'current', 'newer']);
    expect(groups[0].items.find((i: { id: string }) => i.id === 'current')?.isCurrent).toBe(true);
  });

  it('does not add "you are here" to any other kind of shelf', () => {
    const groups = relatedGroups([related('SPIN_OFF', anime('s'))], anime('current'));

    expect(titles(groups)[0].ids).toEqual(['s']);
  });

  it('does nothing with a current anime when there is no series shelf to put it on', () => {
    expect(relatedGroups([], anime('current'))).toEqual([]);
  });

  describe('season parts', () => {
    const part = (id: string, startDate: string, seasonNumber = 2) =>
      anime(id, { seasonNumber, startDate, type: 'TV' });

    const twoCour = (seasonNumber: number) => [
      related('SAME_SERIES', part('part1', '2021-01-01', seasonNumber)),
      related('SAME_SERIES', part('part2', '2021-07-01', seasonNumber))
    ];

    it('lists only the original of a season split across two cours', () => {
      const groups = relatedGroups(twoCour(2), null);

      expect(titles(groups)[0].ids).toEqual(['part1']);
    });

    it('keeps the later part when it is the page the reader is on', () => {
      // On the page for a Part 2, the reader still has to see where they are.
      const groups = relatedGroups(
        [related('SAME_SERIES', part('part1', '2021-01-01'))],
        part('part2', '2021-07-01')
      );

      expect(titles(groups)[0].ids).toEqual(['part1', 'part2']);
    });

    it('still collapses the later part on the original’s own page', () => {
      const groups = relatedGroups(
        [related('SAME_SERIES', part('part2', '2021-07-01'))],
        part('part1', '2021-01-01')
      );

      expect(titles(groups)[0].ids).toEqual(['part1']);
    });

    it('leaves different seasons alone', () => {
      const groups = relatedGroups([...twoCour(1).slice(0, 1), ...twoCour(2).slice(0, 1)], null);

      expect(titles(groups)[0].ids).toEqual(['part1', 'part1']);
    });

    it('does not collapse entries that are not both TV runs', () => {
      const groups = relatedGroups(
        [
          related('SAME_SERIES', anime('tv', { seasonNumber: 2, startDate: '2021-01-01' })),
          related(
            'SAME_SERIES',
            anime('ova', { seasonNumber: 2, startDate: '2021-07-01', type: 'OVA' })
          )
        ],
        null
      );

      expect(titles(groups)[0].ids).toEqual(['tv', 'ova']);
    });

    it('leaves specials and unknown seasons alone', () => {
      const groups = relatedGroups(
        [
          related('SAME_SERIES', anime('sp1', { seasonNumber: 0, startDate: '2021-01-01' })),
          related('SAME_SERIES', anime('sp2', { seasonNumber: 0, startDate: '2021-07-01' })),
          related('SAME_SERIES', anime('unknown1', { startDate: '2021-02-01' })),
          related('SAME_SERIES', anime('unknown2', { startDate: '2021-08-01' }))
        ],
        null
      );

      expect(titles(groups)[0].ids).toEqual(['sp1', 'unknown1', 'sp2', 'unknown2']);
    });
  });
});

describe('entryHref', () => {
  it('prefers the readable slug', () => {
    expect(entryHref({ id: 'abc123', slug: 'frieren' })).toBe('/anime/frieren');
  });

  it('falls back to the id for an entry with no slug', () => {
    expect(entryHref({ id: 'abc123', slug: null })).toBe('/anime/abc123');
    expect(entryHref({ id: 'abc123' })).toBe('/anime/abc123');
  });
});

describe('isMainEntry', () => {
  it('is only TV, in whatever case it arrives', () => {
    expect(isMainEntry('TV')).toBe(true);
    expect(isMainEntry('tv')).toBe(true);
  });

  it('is nothing else', () => {
    for (const type of ['OVA', 'Movie', 'ONA', 'Special', '', null, undefined]) {
      expect(isMainEntry(type)).toBe(false);
    }
  });
});
