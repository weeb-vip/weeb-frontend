import debug from "../utils/debug";

interface AnimePart {
  id?: string;
}

/**
 * The CDN key for an anime's poster.
 *
 * Posters used to be keyed by a slug derived from the title, which meant every
 * consumer had to reproduce the exact lowercase/underscore/escape dance the
 * sync services used — and a corrected title upstream silently orphaned the
 * image. They are keyed by the anime id now, which is stable and needs no
 * derivation. Algolia hits carry the same id, so search results resolve too.
 */
export function GetImageFromAnime(anime: AnimePart | any): string {
  if (!anime?.id) {
    return "not found.png";
  }
  return anime.id;
}

/**
 * Extract the year from a date string using UTC to avoid timezone issues.
 * e.g., "2026-01-01T00:00:00Z" returns "2026" regardless of local timezone.
 */
export function getYearUTC(dateStr: string | null | undefined): string {
  if (!dateStr) return "TBA";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "TBA";
    const year = date.getUTCFullYear();
    if (year <= 1900) return "TBA";
    return year.toString();
  } catch {
    return "TBA";
  }
}

/**
 * Format a date string to "dd MMM yyyy" using UTC to avoid timezone issues.
 */
export function formatDateUTC(dateStr: string | null | undefined, fallback: string = "Unknown"): string {
  if (!dateStr) return fallback;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return fallback;
    const day = date.getUTCDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return fallback;
  }
}

/**
 * The canonical URL path for an anime.
 *
 * Prefers /anime/<slug>. Falls back to /show/<id>, which still works — it
 * permanently redirects — so a caller that has not been given a slug yet
 * degrades to an extra hop rather than a broken link. That matters during the
 * window where MySQL is still catching up on a newly added anime, and it means
 * every call site does not have to be updated in the same commit.
 *
 * Slugs are generated in postgres and are already URL-safe (lowercase, digits
 * and hyphens only), so they are not re-encoded here; ids are, since they reach
 * this function from search results and other untrusted-ish inputs.
 */
export function animeHref(
  anime: { id?: string | null; slug?: string | null } | null | undefined,
  suffix: string = ''
): string {
  if (anime?.slug) return `/anime/${anime.slug}${suffix}`;
  if (anime?.id) return `/show/${encodeURIComponent(anime.id)}${suffix}`;
  return '/';
}
