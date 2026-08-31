/**
 * Shared formatting for works -- manga, light novels, manhwa.
 *
 * These two functions existed in three copies (the manga page, the search page
 * and the autocomplete row) before a fourth was needed for the homepage. They
 * were still identical, which is luck rather than design: the anime and work
 * schemas have already drifted apart on status casing the same way.
 */

/**
 * MANGA -> Manga, LIGHT_NOVEL -> Light novel.
 *
 * Only the first word is capitalised, so it reads as prose rather than a label.
 * The wire value is a plain string rather than an enum because MyAnimeList adds
 * kinds without warning, so an unrecognised one renders as itself instead of
 * being dropped -- "Web manhwa" is better than nothing at all.
 */
export function readableWorkType(value: string | null | undefined): string {
  if (!value) return 'Work';

  const words = value.toLowerCase().split('_');
  return (
    words[0].charAt(0).toUpperCase() +
    words[0].slice(1) +
    (words.length > 1 ? ' ' + words.slice(1).join(' ') : '')
  );
}

/** The publication year, or null when the date is missing or unparseable. */
export function workYear(value: string | null | undefined): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : String(parsed.getUTCFullYear());
}

/**
 * The line under a work's title: what kind of thing it is, then when it began.
 *
 * The kind comes first because it is what separates this card from the anime of
 * the same name sitting a row above it.
 */
export function workSubtitle(
  type: string | null | undefined,
  publishedFrom: string | null | undefined,
): string {
  return [readableWorkType(type), workYear(publishedFrom)].filter(Boolean).join(' · ');
}
