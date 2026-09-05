/**
 * The genre taxonomy the homepage offers as a way into the catalogue.
 *
 * This list used to live as a default prop value inside
 * `primitives/GenrePills.svelte`. The homepage rendered `<GenrePills />` with
 * no props, so a presentational primitive was the sole owner of the site's
 * taxonomy -- sixteen names that appeared nowhere else in the codebase, in a
 * file whose job was a row of pills. Data belongs in a data module; the row of
 * pills is `primitives/ChipRow.svelte`.
 */

/** Alphabetical, and deliberately short: this is a way in, not the full index. */
export const BROWSE_GENRES: readonly string[] = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

/** Where a genre name points on the search page. */
export function genreHref(genre: string): string {
  return `/search?genre=${encodeURIComponent(genre)}`;
}

/** The browse row, ready for `ChipRow`. */
export const BROWSE_GENRE_LINKS: { label: string; href: string }[] = BROWSE_GENRES.map((label) => ({
  label,
  href: genreHref(label),
}));
