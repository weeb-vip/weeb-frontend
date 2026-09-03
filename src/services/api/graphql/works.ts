/**
 * How the work browse pages are shaped: which kinds go on which shelf, and
 * which sorts each shelf offers.
 *
 * Definitions only. The queries themselves live in queries.ts with every other
 * document, so codegen types them.
 */

/**
 * How the catalogue's ten kinds divide into the two shelves readers get.
 *
 * A reader looking for a novel does not distinguish a light novel from a
 * novel, and one looking for a comic does not care whether MyAnimeList filed
 * it as a manga, a manhwa, a one-shot or a doujinshi. Two shelves, then, and
 * the scraper's finer labels stay on each card and on each work's own page.
 *
 * The comics shelf is defined as everything the novels shelf is not, so a kind
 * MyAnimeList invents tomorrow lands somewhere rather than nowhere. That is
 * also the honest reading of "everything else is a manga".
 */
export const NOVEL_TYPES = ['LIGHT_NOVEL', 'NOVEL', 'WEB_NOVEL'] as const;

/**
 * The three shelves, in the order they appear.
 *
 * Popularity leads because it is the only one of the three every row has:
 * score is absent on roughly one work in ten and publishedFrom on more, so
 * opening with either would lead the page with whatever the scraper has not
 * filled in yet.
 *
 * The API also offers TITLE. It is deliberately not here -- an alphabetical
 * wall of 53,000 manga is a sorted list, not a shelf worth browsing, and it
 * answers no question a reader arrives with.
 */
export const WORK_SHELVES = [
  { key: 'popular', sort: 'POPULARITY', label: 'Most popular' },
  { key: 'rated', sort: 'SCORE', label: 'Highest rated' },
  { key: 'newest', sort: 'NEWEST', label: 'Newest' }
] as const;

export type WorkSort = (typeof WORK_SHELVES)[number]['sort'];

export function isWorkSort(value: string | null): value is WorkSort {
  return !!value && WORK_SHELVES.some((s) => s.sort === value);
}

export function shelfLabel(sort: string): string {
  return WORK_SHELVES.find((s) => s.sort === sort)?.label ?? 'Most popular';
}
