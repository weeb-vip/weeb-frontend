import { describe, it, expect } from 'vitest';
import { readable } from 'svelte/store';
import { SvelteMap } from 'svelte/reactivity';
import {
  MangaContentBloc,
  factsFor,
  publishedRange,
  type Work,
} from './MangaContent.bloc.svelte';

/**
 * /manga/<slug> — the source-work page.
 *
 * The page is almost all derivation: one loader record in, a cover, a banner,
 * a credits list, a stats strip and a set of adaptation cards out. The rules
 * worth pinning are the ones that decide what a reader actually sees — which
 * artwork the hero falls back to when a work has no adaptation, which numbers
 * the stats strip is allowed to show, and what a missing field turns into
 * (never a blank row, never an invented dash).
 *
 * `readableWorkType` and `workYear` belong to `$lib/utils/workDisplay` and are
 * exercised here only through the getters that consume them.
 */

/* ── Harness ─────────────────────────────────────────────────────────────── */

/**
 * A loader accessor over a mutable record. It reads through `SvelteMap` because
 * the cover candidates are memoised in a `$derived` — in the view the record is
 * a prop, i.e. a signal, and only a signal invalidates that memo.
 */
function liveSource(initial: { work?: Work | null; ssrError?: string | null } = {}) {
  const box = new SvelteMap<string, { work: Work | null; ssrError: string | null }>([
    ['payload', { work: initial.work ?? null, ssrError: initial.ssrError ?? null }],
  ]);
  return {
    accessor: () => box.get('payload')!,
    set(next: { work?: Work | null; ssrError?: string | null }) {
      box.set('payload', { ...box.get('payload')!, ...next });
    },
  };
}

function build(
  work: Work | null = null,
  options: { ssrError?: string | null; titleLanguage?: 'english' | 'japanese' } = {},
) {
  const source = liveSource({ work, ssrError: options.ssrError ?? null });
  const bloc = new MangaContentBloc({
    source: source.accessor,
    preferences: readable({ titleLanguage: options.titleLanguage ?? 'english' }) as any,
    imageUrl: (id: string, path?: string) => (path ? `cdn/${path}/${id}` : `cdn/${id}`),
  });
  return { bloc, source };
}

const berserk: Work = {
  id: 'w1',
  titleEn: 'Berserk',
  titleJp: 'ベルセルク',
  imageUrl: 'https://cdn.myanimelist.net/images/manga/1/157897.jpg',
  type: 'MANGA',
  status: 'Publishing',
  publishedFrom: '1989-08-25T00:00:00Z',
  publishedTo: null,
  authors: ['Kentaro Miura'],
  serialization: 'Young Animal',
  demographic: 'Seinen',
  volumes: 42,
  chapters: 375,
  score: 9.47,
  ranking: 1,
  synopsis: 'Guts, a former mercenary...',
  adaptations: [],
};

/* ── The record ──────────────────────────────────────────────────────────── */

describe('what the page has to work with', () => {
  it('has a work when the loader succeeded', () => {
    const { bloc } = build(berserk);

    expect(bloc.hasWork).toBe(true);
    expect(bloc.work).toBe(berserk);
    expect(bloc.ssrError).toBeNull();
  });

  it('has nothing to render when the loader failed, even if a record came with it', () => {
    const { bloc } = build(berserk, { ssrError: 'Work not found' });

    // A stale record behind an error banner is worse than an honest error.
    expect(bloc.hasWork).toBe(false);
    expect(bloc.ssrError).toBe('Work not found');
  });

  it('has nothing to render when there is no record at all', () => {
    const { bloc } = build(null);

    expect(bloc.hasWork).toBe(false);
  });

  it('reads the accessor live, so navigating to another work re-reads it', () => {
    const { bloc, source } = build(berserk);

    expect(bloc.title).toBe('Berserk');
    expect(bloc.coverSources).toEqual(['cdn/works/w1', berserk.imageUrl]);

    source.set({ work: { id: 'w2', titleEn: 'Vagabond' } });

    expect(bloc.title).toBe('Vagabond');
    expect(bloc.coverSources).toEqual(['cdn/works/w2']);
  });
});

describe('titles', () => {
  it('prefers the English title', () => {
    expect(build(berserk).bloc.title).toBe('Berserk');
  });

  it('falls back to the Japanese one rather than showing nothing', () => {
    expect(build({ titleJp: 'ベルセルク' }).bloc.title).toBe('ベルセルク');
  });

  it('says Untitled rather than leaving the heading empty', () => {
    expect(build({}).bloc.title).toBe('Untitled');
    expect(build(null).bloc.title).toBe('Untitled');
  });

  it('shows a second line only when it says something the first did not', () => {
    expect(build(berserk).bloc.japaneseTitle).toBe('ベルセルク');
    expect(build({ titleEn: 'Berserk', titleJp: 'Berserk' }).bloc.japaneseTitle).toBeNull();
    expect(build({ titleEn: 'Berserk' }).bloc.japaneseTitle).toBeNull();
  });
});

/* ── Artwork ─────────────────────────────────────────────────────────────── */

describe('the cover', () => {
  it('takes our CDN copy first and keeps MyAnimeList as the last resort', () => {
    const { bloc } = build(berserk);

    // The record's own imageUrl is MyAnimeList's host; it is only there for a
    // work whose cover has not been synced yet.
    expect(bloc.coverSources).toEqual(['cdn/works/w1', berserk.imageUrl]);
  });

  it('has no candidates for a record with no id', () => {
    expect(build({ titleEn: 'Nameless', imageUrl: 'https://example.test/x.jpg' }).bloc.coverSources)
      .toEqual([]);
  });

  it('drops the fallback when the record carries no image of its own', () => {
    expect(build({ id: 'w1' }).bloc.coverSources).toEqual(['cdn/works/w1']);
  });

  it('hands back the same array on every read, so the image loader is not restarted', () => {
    const { bloc } = build(berserk);

    expect(bloc.coverSources).toBe(bloc.coverSources);
  });
});

describe('the hero banner', () => {
  it('uses the oldest adaptation\'s wide key art when there is one', () => {
    const { bloc } = build({ ...berserk, adaptations: [{ id: 'a1' }, { id: 'a2' }] });

    // A 2:3 cover blown up to banner width is a fallback, not a design.
    expect(bloc.heroSources).toEqual(['cdn/banners/a1', 'cdn/a1', 'cdn/works/w1', berserk.imageUrl]);
  });

  it('falls back to the cover for a work nothing was made from', () => {
    const { bloc } = build(berserk);

    expect(bloc.heroSources).toEqual(bloc.coverSources);
  });

  it('falls back to the cover when the adaptation has no id to key art by', () => {
    const { bloc } = build({ ...berserk, adaptations: [{ titleEn: 'Berserk (1997)' }] });

    expect(bloc.heroSources).toEqual(bloc.coverSources);
  });

  it('treats the hero as a banner only once a banner actually won', () => {
    const { bloc } = build({ ...berserk, adaptations: [{ id: 'a1' }] });

    expect(bloc.heroIsBanner).toBe(false);

    bloc.heroChosen({ src: 'cdn/banners/a1', reason: 'loaded' });
    expect(bloc.heroIsBanner).toBe(true);
  });

  it('drops back to the portrait treatment when a later candidate won instead', () => {
    const { bloc } = build({ ...berserk, adaptations: [{ id: 'a1' }] });

    bloc.heroChosen({ src: 'cdn/banners/a1', reason: 'loaded' });
    bloc.heroChosen({ src: 'cdn/works/w1', reason: 'fallback' });

    // A portrait shown at banner treatment looks like a mistake.
    expect(bloc.heroIsBanner).toBe(false);
  });

  it('is not a banner when every candidate failed', () => {
    const { bloc } = build({ ...berserk, adaptations: [{ id: 'a1' }] });

    bloc.heroChosen({ src: null, reason: 'exhausted' });

    expect(bloc.heroIsBanner).toBe(false);
  });
});

/* ── The meta line ───────────────────────────────────────────────────────── */

describe('publishedRange', () => {
  it('runs from one year to another', () => {
    expect(publishedRange('1997-07-22', '2008-05-21', 'Finished')).toBe('1997 – 2008');
  });

  it('gives a single year when a work began and ended in the same one', () => {
    expect(publishedRange('1997-01-05', '1997-11-30', 'Finished')).toBe('1997');
  });

  it('says ongoing for a work that is still being published', () => {
    expect(publishedRange('1989-08-25', null, 'Publishing')).toBe('1989 – ongoing');
    expect(publishedRange('1989-08-25', null, 'currently publishing')).toBe('1989 – ongoing');
  });

  it('does not invent an end for a finished work with no end date', () => {
    // A dash would claim we know when it stopped, and we do not.
    expect(publishedRange('1989-08-25', null, 'Finished')).toBe('1989');
    expect(publishedRange('1989-08-25', null, null)).toBe('1989');
  });

  it('is nothing at all without a usable start', () => {
    expect(publishedRange(null, '2008-05-21', 'Finished')).toBeNull();
    expect(publishedRange('not a date', null, 'Publishing')).toBeNull();
    expect(publishedRange('', '', '')).toBeNull();
  });
});

describe('the meta line', () => {
  it('reads type, then years, then status', () => {
    const { bloc } = build(berserk);

    expect(bloc.metaLine).toEqual([
      { label: 'Manga', mono: false },
      { label: '1989 – ongoing', mono: true },
      { label: 'Publishing', mono: false },
    ]);
    expect(bloc.publishedRange).toBe('1989 – ongoing');
  });

  it('leaves out the parts the record does not have', () => {
    const { bloc } = build({ id: 'w1', type: 'LIGHT_NOVEL' });

    expect(bloc.readableType).toBe('Light novel');
    expect(bloc.metaLine).toEqual([{ label: 'Light novel', mono: false }]);
  });

  it('calls an unknown kind a Work rather than dropping the line', () => {
    const { bloc } = build({ id: 'w1' });

    expect(bloc.readableType).toBe('Work');
    expect(bloc.metaLine).toEqual([{ label: 'Work', mono: false }]);
  });
});

/* ── Credits ─────────────────────────────────────────────────────────────── */

describe('credits', () => {
  it('names the three things a reader was missing, as plain nouns', () => {
    const { bloc } = build(berserk);

    expect(bloc.credits).toEqual([
      { label: 'Author', value: 'Kentaro Miura' },
      { label: 'Magazine', value: 'Young Animal' },
      { label: 'Audience', value: 'Seinen' },
    ]);
  });

  it('pluralises the author row and joins the names', () => {
    const { bloc } = build({ ...berserk, authors: ['Riichiro Inagaki', 'Boichi'] });

    expect(bloc.credits[0]).toEqual({
      label: 'Authors',
      value: 'Riichiro Inagaki, Boichi',
    });
  });

  it('leaves out a row rather than printing an empty one', () => {
    const { bloc } = build({ id: 'w1', authors: [], serialization: null, demographic: null });

    expect(bloc.credits).toEqual([]);
  });

  it('has no credits at all without a record', () => {
    expect(build(null).bloc.credits).toEqual([]);
  });
});

/* ── The stats strip ─────────────────────────────────────────────────────── */

describe('factsFor', () => {
  it('shows the four measures the page is accountable for', () => {
    expect(factsFor(berserk)).toEqual([
      { label: 'Volumes', value: '42' },
      { label: 'Chapters', value: '375' },
      { label: 'Score', value: '9.47' },
      { label: 'Ranked', value: '#1' },
    ]);
  });

  it('groups large counts so six figures stay scannable', () => {
    expect(factsFor({ chapters: 1234, ranking: 15678 })).toEqual([
      { label: 'Chapters', value: '1,234' },
      { label: 'Ranked', value: '#15,678' },
    ]);
  });

  it('always gives a score two decimal places', () => {
    expect(factsFor({ score: 9 })[0]).toEqual({ label: 'Score', value: '9.00' });
    expect(factsFor({ score: 8.5 })[0]).toEqual({ label: 'Score', value: '8.50' });
  });

  it('keeps a genuine zero, which is a fact rather than a gap', () => {
    expect(factsFor({ volumes: 0, chapters: 0 })).toEqual([
      { label: 'Volumes', value: '0' },
      { label: 'Chapters', value: '0' },
    ]);
  });

  it('drops every measure the record does not carry', () => {
    expect(factsFor({ id: 'w1' })).toEqual([]);
    expect(factsFor({ volumes: null, chapters: undefined, score: null, ranking: null })).toEqual([]);
  });

  it('has nothing to say about no work at all', () => {
    expect(factsFor(null)).toEqual([]);
  });

  it('never shows MyAnimeList community counts as if they were ours', () => {
    const labels = factsFor({ ...berserk, members: 600000, favorites: 90000 } as Work).map(
      (fact) => fact.label,
    );

    expect(labels).not.toContain('Members');
    expect(labels).not.toContain('Favorites');
  });

  it('is what the bloc hands the strip', () => {
    expect(build(berserk).bloc.facts).toEqual(factsFor(berserk));
  });
});

/* ── Synopsis and adaptations ────────────────────────────────────────────── */

describe('the synopsis', () => {
  it('is the record\'s own text', () => {
    expect(build(berserk).bloc.synopsis).toBe('Guts, a former mercenary...');
  });

  it('is nothing when the field is empty, so the section can be left out', () => {
    expect(build({ id: 'w1', synopsis: '' }).bloc.synopsis).toBeNull();
    expect(build({ id: 'w1' }).bloc.synopsis).toBeNull();
    expect(build(null).bloc.synopsis).toBeNull();
  });
});

describe('adaptations', () => {
  it('lists what the query returned', () => {
    const adaptations = [{ id: 'a1', titleEn: 'Berserk' }];
    expect(build({ ...berserk, adaptations }).bloc.adaptations).toEqual(adaptations);
  });

  it('is an empty list, not null, when nothing was adapted', () => {
    expect(build({ id: 'w1' }).bloc.adaptations).toEqual([]);
    expect(build(null).bloc.adaptations).toEqual([]);
  });

  it('titles a card in the language the reader chose', () => {
    const anime = { titleEn: 'Berserk', titleJp: 'ベルセルク' };

    expect(build(berserk).bloc.adaptationTitle(anime)).toBe('Berserk');
    expect(build(berserk, { titleLanguage: 'japanese' }).bloc.adaptationTitle(anime)).toBe(
      'ベルセルク',
    );
  });

  it('says Unknown rather than leaving a card blank', () => {
    expect(build(berserk).bloc.adaptationTitle(null)).toBe('Unknown');
    expect(build(berserk).bloc.adaptationTitle({})).toBe('Unknown');
  });

  it('subtitles a card with the year alone, which is what places it', () => {
    const { bloc } = build(berserk);

    expect(bloc.adaptationSubtitle({ startDate: '1997-10-08T00:00:00Z' })).toBe('1997');
    expect(bloc.adaptationSubtitle({ startDate: null })).toBe('');
    expect(bloc.adaptationSubtitle({})).toBe('');
  });

  it('says plainly that nothing was made from this work, in its own words', () => {
    // Most works genuinely have no adaptation; the line is not an apology.
    expect(build(berserk).bloc.noAdaptationsMessage).toBe(
      'No anime has been made from this manga — or none that we know of yet.',
    );
    expect(build({ id: 'w1', type: 'LIGHT_NOVEL' }).bloc.noAdaptationsMessage).toBe(
      'No anime has been made from this light novel — or none that we know of yet.',
    );
    expect(build(null).bloc.noAdaptationsMessage).toBe(
      'No anime has been made from this work — or none that we know of yet.',
    );
  });
});

/* ── Boundaries ──────────────────────────────────────────────────────────── */

describe('a page with no record', () => {
  it('reads as empty everywhere rather than throwing', () => {
    const { bloc } = build(null);

    expect(bloc.work).toBeNull();
    expect(bloc.coverSources).toEqual([]);
    expect(bloc.heroSources).toEqual([]);
    expect(bloc.heroIsBanner).toBe(false);
    expect(bloc.publishedRange).toBeNull();
    expect(bloc.metaLine).toEqual([{ label: 'Work', mono: false }]);
    expect(bloc.credits).toEqual([]);
    expect(bloc.facts).toEqual([]);
    expect(bloc.synopsis).toBeNull();
    expect(bloc.adaptations).toEqual([]);
  });

  it('is built with a real default source, so it can be constructed with no ports', () => {
    const bloc = new MangaContentBloc();

    expect(bloc.work).toBeNull();
    expect(bloc.hasWork).toBe(false);
  });
});
