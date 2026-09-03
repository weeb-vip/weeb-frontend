/**
 * The paged works query behind /manga and /light-novels.
 *
 * A plain string rather than a `graphql()` document, unlike everything in
 * queries.ts. The client preset types documents against a schema fetched from
 * the staging gateway at codegen time, and `works` does not exist there until
 * anime-api ships -- so running codegen today would fail on this query and
 * writing it as a typed document would not compile. graphql-request takes a
 * string just as happily, and `fetchWithFallback` is typed `any`.
 *
 * Move it into queries.ts once the API is deployed to staging and codegen can
 * see the field. Nothing else has to change; the shape here is already what the
 * generated document would be.
 */
export const getWorksByType = /* GraphQL */ `
  query getWorksByType($input: WorksInput!) {
    works(input: $input) {
      total
      page
      perPage
      works {
        id
        urlSlug
        titleEn
        titleJp
        type
        imageUrl
        status
        score
        members
        volumes
        chapters
        publishedFrom
        demographic
        authors
      }
    }
  }
`;

/** Sorts the browse pages offer, matching WorksInput.sortBy on the API. */
export const WORK_SORTS = [
  { value: 'POPULARITY', label: 'Most popular' },
  { value: 'SCORE', label: 'Highest rated' },
  { value: 'NEWEST', label: 'Newest' },
  { value: 'TITLE', label: 'A–Z' }
] as const;

export type WorkSort = (typeof WORK_SORTS)[number]['value'];

export function isWorkSort(value: string | null): value is WorkSort {
  return !!value && WORK_SORTS.some((s) => s.value === value);
}
