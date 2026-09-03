/**
 * The works queries behind /manga and /light-novels.
 *
 * Plain strings rather than `graphql()` documents, unlike everything in
 * queries.ts. The client preset types documents against a schema fetched from
 * the staging gateway at codegen time, and `works` landed there only just now
 * -- so these move into queries.ts on the next codegen run. Nothing else has
 * to change; the shapes here are already what the generated documents would be.
 */

const WORK_FIELDS = /* GraphQL */ `
  id
  urlSlug
  titleEn
  titleJp
  type
  status
  score
  members
  publishedFrom
`;

/**
 * The shelf view: three sorts in one round trip.
 *
 * Aliased rather than three requests, because the page renders all three at
 * once and three sequential SSR fetches would put their latencies end to end
 * on every page load.
 */
export const getWorksOverview = /* GraphQL */ `
  query getWorksOverview($popular: WorksInput!, $rated: WorksInput!, $newest: WorksInput!) {
    popular: works(input: $popular) { total works { ${WORK_FIELDS} } }
    rated: works(input: $rated) { total works { ${WORK_FIELDS} } }
    newest: works(input: $newest) { total works { ${WORK_FIELDS} } }
  }
`;

/** The paged view behind a shelf's "See all". */
export const getWorksByType = /* GraphQL */ `
  query getWorksByType($input: WorksInput!) {
    works(input: $input) {
      total
      page
      perPage
      works { ${WORK_FIELDS} }
    }
  }
`;

/**
 * How the catalogue's ten kinds divide into the two shelves readers get.
 *
 * A reader looking for a novel does not distinguish a light novel from a
 * novel, and one looking for a comic does not care whether MyAnimeList filed
 * it as a manga, a manhwa, a one-shot or a doujinshi. Two shelves, then, and
 * the scraper's finer labels stay available on each work's own page.
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
