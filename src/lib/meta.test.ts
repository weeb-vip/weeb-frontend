import { describe, it, expect } from 'vitest';
import {
  animeFactsDescription,
  hasRealSynopsis,
  isThinAnime,
  isThinWork,
  metaDescription,
  realSynopsis,
  workFactsDescription
} from './meta';

// The real synopsis that exposed every one of these problems in production.
const REAL = `The sorcerer Luck believes this to be the end. Besieged by powerful demons, he makes the noble sacrifice of holding back their onslaught while his friends escape.

Following his triumph, Luck soon reunites with his friends.

[Written by MAL Rewrite]`;

describe('metaDescription', () => {
  it('never cuts mid-word', () => {
    const out = metaDescription(REAL)!;
    // Everything before the ellipsis must be whole words.
    const body = out.replace(/…$/, '');
    expect(REAL.replace(/\s+/g, ' ')).toContain(body);
    expect(body.endsWith(' ')).toBe(false);
  });

  it('collapses the newlines that leaked into the meta tag', () => {
    expect(metaDescription(REAL)).not.toMatch(/[\n\r]/);
  });

  it('strips the MyAnimeList attribution', () => {
    expect(metaDescription(REAL, 500)).not.toContain('[Written by MAL Rewrite]');
    expect(metaDescription('Short one. [Source: ANN]', 500)).toBe('Short one.');
  });

  it('adds no ellipsis when nothing was removed', () => {
    expect(metaDescription('A complete sentence.')).toBe('A complete sentence.');
    expect(metaDescription('A complete sentence.')).not.toContain('…');
  });

  it('respects the length budget', () => {
    const out = metaDescription(REAL, 160)!;
    expect(out.length).toBeLessThanOrEqual(161); // 160 + the ellipsis character
  });

  it('does not leave dangling punctuation before the ellipsis', () => {
    // Cutting right after a comma used to give "…the end,…"
    const out = metaDescription('one two three, four five six seven', 15)!;
    expect(out).not.toMatch(/[,\s]…$/);
    expect(out.endsWith('…')).toBe(true);
  });

  it('hard-cuts rather than returning nothing for one enormous word', () => {
    const out = metaDescription('x'.repeat(400), 160)!;
    expect(out.length).toBe(161);
  });

  it('returns null for empty or missing input', () => {
    expect(metaDescription(null)).toBeNull();
    expect(metaDescription(undefined)).toBeNull();
    expect(metaDescription('')).toBeNull();
    expect(metaDescription('   ')).toBeNull();
  });
});

describe('placeholder synopses', () => {
  const MAL = 'No synopsis information has been added to this title. Help improve our database by adding a synopsis here.';

  it('counts the MyAnimeList and AniDB placeholders, and the CDC marker, as no synopsis', () => {
    expect(hasRealSynopsis(MAL)).toBe(false);
    expect(hasRealSynopsis('No synopsis has been added for this series yet.')).toBe(false);
    expect(hasRealSynopsis('__debezium_unavailable_value')).toBe(false);
    expect(hasRealSynopsis('  ')).toBe(false);
    expect(hasRealSynopsis(null)).toBe(false);
  });

  it('keeps a short but real synopsis', () => {
    expect(hasRealSynopsis('A short animation by Taku Furukawa.')).toBe(true);
    expect(realSynopsis('A short animation by Taku Furukawa.')).toBe('A short animation by Taku Furukawa.');
    expect(realSynopsis(MAL)).toBeNull();
  });
});

describe('animeFactsDescription', () => {
  it('says something specific to the show', () => {
    const out = animeFactsDescription({
      title: 'Inaka ni wa Kore Kurai',
      type: 'OVA',
      startDate: '2026-07-31T00:00:00Z',
      studios: ['T-Rex'],
      animeStatus: 'Currently Airing',
      source: 'Manga'
    });
    expect(out).toBe(
      'Inaka ni wa Kore Kurai: OVA (2026) by T-Rex, adapted from a manga. Currently Airing. Track episodes and add it to your list on WeebVIP.'
    );
  });

  it('drops clauses for missing fields rather than printing undefined', () => {
    const out = animeFactsDescription({ title: 'X' });
    expect(out).toBe('X: Anime. Track episodes and add it to your list on WeebVIP.');
    expect(out).not.toMatch(/undefined|null/);
  });

  it("skips MyAnimeList's 'None found, add some' studio placeholder", () => {
    expect(animeFactsDescription({ title: 'Z', type: 'Movie', studios: ['None found', 'add some'] })).toBe(
      'Z: Movie. Track episodes and add it to your list on WeebVIP.'
    );
  });

  it('includes genres and episode count, and leaves out "Finished Airing"', () => {
    const out = animeFactsDescription({
      title: 'Y',
      type: 'TV',
      tags: ['Action', 'Drama'],
      episodeCount: 12,
      animeStatus: 'Finished Airing',
      source: 'Original'
    });
    expect(out).toBe('Y: TV. Action, Drama. 12 episodes. Track episodes and add it to your list on WeebVIP.');
  });

  it('stays within a meta description length', () => {
    const out = animeFactsDescription({
      title: 'A'.repeat(120),
      type: 'TV',
      studios: ['Studio One', 'Studio Two'],
      tags: ['Action', 'Adventure', 'Fantasy']
    });
    expect(out.length).toBeLessThanOrEqual(161);
  });
});

describe('isThinAnime / isThinWork', () => {
  it('only a finished show with no synopsis is thin', () => {
    expect(isThinAnime({ description: null, animeStatus: 'Finished Airing' })).toBe(true);
    expect(isThinAnime({ description: null, animeStatus: 'Currently Airing' })).toBe(false);
    expect(isThinAnime({ description: null, animeStatus: 'Not yet aired' })).toBe(false);
    expect(isThinAnime({ description: 'Real prose.', animeStatus: 'Finished Airing' })).toBe(false);
  });

  it('a work still publishing is kept without a synopsis', () => {
    expect(isThinWork({ synopsis: '', status: 'Finished' })).toBe(true);
    expect(isThinWork({ synopsis: '', status: 'Publishing' })).toBe(false);
    expect(isThinWork({ synopsis: 'Prose.', status: 'Finished' })).toBe(false);
  });

  it('describes a work from its facts', () => {
    expect(
      workFactsDescription({
        title: 'Oyasumi Punpun',
        type: 'MANGA',
        authors: ['Asano, Inio'],
        publishedFrom: '2007-03-15',
        volumes: 13,
        status: 'Finished'
      })
    ).toBe('Oyasumi Punpun: Manga by Asano, Inio (2007). 13 volumes. Track it and its anime adaptations on WeebVIP.');
  });
});
