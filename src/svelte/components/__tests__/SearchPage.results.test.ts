import { describe, it, expect } from '@jest/globals';
import {
  filterAndSortHits,
  isDoubledGenre,
  isRealGenre,
  listExcerpt,
  normalizeHit,
  parseJsonField,
  toGenreFacets,
  yearOptions,
  type NormalizedHit,
} from '../SearchPage.results';

/**
 * Turning Algolia's answer into what /search renders. The anime index stores
 * the CDC payload verbatim, so this is where two schemas meet -- and where the
 * bad values the scraper let through have to be caught.
 */
describe('parseJsonField', () => {
  it('passes an array through', () => {
    expect(parseJsonField(['Action', 'Comedy'])).toEqual(['Action', 'Comedy']);
  });

  it('parses the JSON string form older records carry', () => {
    expect(parseJsonField('["Action","Comedy"]')).toEqual(['Action', 'Comedy']);
  });

  it('is empty for anything unparseable rather than throwing', () => {
    expect(parseJsonField('not json')).toEqual([]);
    expect(parseJsonField(null)).toEqual([]);
    expect(parseJsonField(undefined)).toEqual([]);
    expect(parseJsonField(42)).toEqual([]);
  });

  it('is empty for valid JSON that is not an array', () => {
    expect(parseJsonField('{"a":1}')).toEqual([]);
  });
});

describe('normalizeHit', () => {
  it('maps Algolia field names onto the ones the cards read', () => {
    const hit = normalizeHit({
      synopsis: 'A ninja.',
      genres: '["Action"]',
      studios: '["Pierrot"]',
      episodes: 220,
      rating: '8.4',
      start_date: '2002-10-03T00:00:00Z',
    });

    expect(hit.description).toBe('A ninja.');
    expect(hit.tags).toEqual(['Action']);
    expect(hit.studiosList).toEqual(['Pierrot']);
    expect(hit.episodeCount).toBe(220);
    expect(hit.ratingNum).toBeCloseTo(8.4);
    expect(hit.yearNum).toBe(2002);
  });

  it('prefers an explicit year over one derived from the start date', () => {
    expect(normalizeHit({ year: 1999, start_date: '2002-01-01' }).yearNum).toBe(1999);
  });

  it('leaves missing numbers null rather than NaN or zero', () => {
    const hit = normalizeHit({});
    expect(hit.ratingNum).toBeNull();
    expect(hit.episodeCount).toBeNull();
    expect(hit.yearNum).toBeNull();
    expect(hit.description).toBe('');
  });
});

describe('genre facets', () => {
  it('spots a genre doubled onto itself', () => {
    expect(isDoubledGenre('FantasyFantasy')).toBe(true);
    expect(isDoubledGenre('Fantasy')).toBe(false);
    // Two characters is too short to tell a duplication from a real name.
    expect(isDoubledGenre('AA')).toBe(false);
  });

  it('rejects the scraper placeholders that reach the index as genres', () => {
    expect(isRealGenre('None found')).toBe(false);
    expect(isRealGenre(' add some')).toBe(false);
    expect(isRealGenre('   ')).toBe(false);
    expect(isRealGenre('')).toBe(false);
    expect(isRealGenre('Action')).toBe(true);
  });

  it('orders the browse strip by how much of the catalogue carries each genre', () => {
    expect(
      toGenreFacets({ Comedy: 900, Action: 1200, 'None found': 40, DramaDrama: 12, Drama: 500 }),
    ).toEqual([
      { name: 'Action', count: 1200 },
      { name: 'Comedy', count: 900 },
      { name: 'Drama', count: 500 },
    ]);
  });

  it('is empty when the facet came back missing', () => {
    expect(toGenreFacets(null)).toEqual([]);
    expect(toGenreFacets(undefined)).toEqual([]);
  });
});

describe('filterAndSortHits', () => {
  const hits = [
    { title_en: 'Bebop', tags: ['Action'], status: 'FINISHED_AIRING', yearNum: 1998, ratingNum: 8.8, start_date: '1998-04-03' },
    { title_en: 'Aria', tags: ['Slice of Life'], status: 'FINISHED_AIRING', yearNum: 2005, ratingNum: 8.1, start_date: '2005-10-06' },
    { title_en: 'Chainsaw Man', tags: ['Action', 'Horror'], status: 'CURRENTLY_AIRING', yearNum: 2022, ratingNum: 8.5, start_date: '2022-10-12' },
  ] as unknown as NormalizedHit[];

  const none = { genre: null, status: '', year: '', sort: 'relevance' as const };

  it('leaves the order Algolia chose when nothing is set', () => {
    expect(filterAndSortHits(hits, none).map((h) => h.title_en)).toEqual([
      'Bebop',
      'Aria',
      'Chainsaw Man',
    ]);
  });

  it('does not mutate the array it was given', () => {
    const original = hits.map((h) => h.title_en);
    filterAndSortHits(hits, { ...none, sort: 'title' });
    expect(hits.map((h) => h.title_en)).toEqual(original);
  });

  it('matches a genre case-insensitively', () => {
    expect(filterAndSortHits(hits, { ...none, genre: 'action' }).map((h) => h.title_en)).toEqual([
      'Bebop',
      'Chainsaw Man',
    ]);
  });

  it('filters by status and by year', () => {
    expect(
      filterAndSortHits(hits, { ...none, status: 'CURRENTLY_AIRING' }).map((h) => h.title_en),
    ).toEqual(['Chainsaw Man']);
    expect(filterAndSortHits(hits, { ...none, year: '2005' }).map((h) => h.title_en)).toEqual([
      'Aria',
    ]);
  });

  it('sorts by score, newest and title', () => {
    expect(filterAndSortHits(hits, { ...none, sort: 'score' }).map((h) => h.title_en)).toEqual([
      'Bebop',
      'Chainsaw Man',
      'Aria',
    ]);
    expect(filterAndSortHits(hits, { ...none, sort: 'newest' }).map((h) => h.title_en)).toEqual([
      'Chainsaw Man',
      'Aria',
      'Bebop',
    ]);
    expect(filterAndSortHits(hits, { ...none, sort: 'title' }).map((h) => h.title_en)).toEqual([
      'Aria',
      'Bebop',
      'Chainsaw Man',
    ]);
  });

  it('combines a filter with a sort', () => {
    expect(
      filterAndSortHits(hits, { ...none, genre: 'Action', sort: 'newest' }).map((h) => h.title_en),
    ).toEqual(['Chainsaw Man', 'Bebop']);
  });
});

describe('yearOptions', () => {
  it('runs from next year down to 1990', () => {
    const years = yearOptions(new Date('2024-06-01T00:00:00Z'));
    expect(years[0]).toBe(2025);
    expect(years[years.length - 1]).toBe(1990);
  });
});

describe('listExcerpt', () => {
  it('strips markup the synopsis carries', () => {
    expect(listExcerpt('<p>A <em>ninja</em>.</p>')).toBe('A ninja.');
  });

  it('cuts to length and marks the cut', () => {
    expect(listExcerpt('x'.repeat(200))).toBe(`${'x'.repeat(180)}...`);
  });

  it('leaves a short line alone', () => {
    expect(listExcerpt('short')).toBe('short');
    expect(listExcerpt(null)).toBe('');
  });
});
