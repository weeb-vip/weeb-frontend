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
 * Always /anime/..., using the slug when there is one and the id otherwise —
 * the route resolves both. Falling back to /show/<id> instead would be a dead
 * end, because that route can only redirect if a slug exists: no slug would
 * mean a link to /show/<id> which has nowhere to send the reader.
 *
 * An anime has an id from the moment it is created but only gets a slug once
 * CDC carries one through to MySQL, so the id form is what keeps a brand-new
 * anime reachable. /anime/<id> permanently redirects to /anime/<slug> as soon
 * as the slug lands, so only one URL is ever canonical.
 *
 * Slugs are generated in postgres and already URL-safe (lowercase, digits and
 * hyphens), so they are not re-encoded; ids are, since they reach this function
 * from search results and other loosely-typed inputs.
 */
export function animeHref(
  anime: { id?: string | null; slug?: string | null } | null | undefined,
  suffix: string = ''
): string {
  if (anime?.slug) return `/anime/${anime.slug}${suffix}`;
  if (anime?.id) return `/anime/${encodeURIComponent(anime.id)}${suffix}`;
  return '/';
}
