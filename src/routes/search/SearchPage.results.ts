/**
 * Turning Algolia's answer into what the /search page renders.
 *
 * Pure, and a plain module for the same reason `SearchPage.urlState.ts` is: the
 * normalisation is where two schemas meet -- the anime index stores the CDC
 * payload verbatim, so its field names are neither ours nor consistent -- and
 * the facet cleaning is a set of rules about bad data that are worth pinning
 * down in tests rather than in a component.
 */

/** One Algolia hit. Deliberately loose: two indices, neither of them ours. */
export type Hit = any;

/** A hit after normalisation, with the fields the cards actually read. */
export interface NormalizedHit extends Record<string, any> {
  description: string;
  tags: string[];
  studiosList: string[];
  episodeCount: number | null;
  ratingNum: number | null;
  yearNum: number | null;
}

export interface GenreFacet {
  name: string;
  count: number;
}

export type SortKey = 'relevance' | 'score' | 'newest' | 'title';

/**
 * Genres, studios and licensors arrive as JSON *strings* on some records and
 * as arrays on others, depending on when the record was last indexed.
 */
export function parseJsonField(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Algolia's field names mapped onto ours, once, at the edge. */
export function normalizeHit(hit: Hit): NormalizedHit {
  return {
    ...hit,
    description: hit.synopsis || hit.description || '',
    tags: parseJsonField(hit.genres ?? hit.tags),
    studiosList: parseJsonField(hit.studios),
    episodeCount: hit.episodes || hit.episode_count || null,
    ratingNum: hit.rating ? parseFloat(hit.rating) : null,
    yearNum: hit.year || (hit.start_date ? new Date(hit.start_date).getFullYear() : null),
  };
}

/**
 * Placeholder text the scraper writes when a source had no genres. It reaches
 * the index as if it were a genre, and without this the browse strip offers
 * "None found" as something to click.
 */
const NON_GENRES = new Set(['None found', ' add some', '']);

/**
 * A genre doubled onto itself -- "FantasyFantasy" -- from a scrape that
 * concatenated the same value twice. Only even-length strings can be one, and
 * two characters is too short to tell "AA" the band from a duplication.
 */
export function isDoubledGenre(name: string): boolean {
  const length = name.length;
  if (length <= 2 || length % 2 !== 0) return false;
  const half = length / 2;
  return name.slice(0, half) === name.slice(half);
}

export function isRealGenre(name: string): boolean {
  if (!name || NON_GENRES.has(name) || name.trim() === '') return false;
  return !isDoubledGenre(name);
}

/**
 * The browse strip, from Algolia's `tags` facet counts.
 *
 * 'tags', not 'genres': the search document renamed the field to match what the
 * rest of the app calls it, and only configured facets can be requested --
 * asking for 'genres' now returns nothing, so the browse list silently came
 * back empty.
 *
 * Ordered by how many titles carry each genre, which is the order a reader
 * would guess: the strip's first row is the genres the catalogue is made of.
 */
export function toGenreFacets(facets: Record<string, number> | null | undefined): GenreFacet[] {
  return Object.entries(facets ?? {})
    .filter(([name]) => isRealGenre(name))
    .map(([name, count]) => ({ name, count: count as number }))
    .sort((a, b) => b.count - a.count);
}

/**
 * The client-side pass over the page of hits Algolia returned.
 *
 * Deliberately client-side: status, year and sort narrow *this page* rather
 * than re-querying, so flipping between them is instant. The genre is applied
 * server-side as well; repeating it here catches the window between a chip
 * click and the response landing, when the old page is still on screen.
 */
export function filterAndSortHits(
  hits: NormalizedHit[],
  filters: { genre: string | null; status: string; year: string; sort: SortKey },
): NormalizedHit[] {
  let out = [...hits];

  if (filters.genre) {
    const wanted = filters.genre.toLowerCase();
    out = out.filter((hit) => hit.tags?.some((tag: string) => tag.toLowerCase() === wanted));
  }

  if (filters.status) out = out.filter((hit) => hit.status === filters.status);
  if (filters.year) out = out.filter((hit) => hit.yearNum === parseInt(filters.year, 10));

  if (filters.sort === 'score') {
    out.sort((a, b) => (b.ratingNum || 0) - (a.ratingNum || 0));
  } else if (filters.sort === 'newest') {
    out.sort((a, b) => {
      const da = a.start_date ? new Date(a.start_date).getTime() : 0;
      const db = b.start_date ? new Date(b.start_date).getTime() : 0;
      return db - da;
    });
  } else if (filters.sort === 'title') {
    out.sort((a, b) => (a.title_en || '').localeCompare(b.title_en || ''));
  }

  return out;
}

/** The years a reader can filter to: next year down to 1990, newest first. */
export function yearOptions(now: Date = new Date()): number[] {
  const years: number[] = [];
  for (let year = now.getFullYear() + 1; year >= 1990; year--) years.push(year);
  return years;
}

/** Strips markup and cuts to a length the list row can hold. */
export function listExcerpt(description: string | null | undefined, max = 180): string {
  const text = (description ?? '').replace(/<[^>]*>/g, '');
  return text.length > max ? `${text.slice(0, max)}...` : text;
}
