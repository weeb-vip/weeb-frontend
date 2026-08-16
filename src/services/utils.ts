import debug from "../utils/debug";

interface AnimePart {
  id?: string;
  titleEn?: string;
  titleJp?: string;
  title_en?: string;
  title_jp?: string;
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
 * The key an anime's poster was stored under before the move to ids.
 *
 * Still needed, and not only while the backfill runs. Where two anime share a
 * title they shared one object, so the backfill cannot tell whose it is and
 * deliberately leaves it alone — those shows have no id-keyed poster and never
 * will. Falling back to the old key restores what they showed before.
 *
 * getSafeImageUrl encodes once more on top of this, which is what the stored
 * key needs: the object is named with the single-escaped form, so the request
 * path has to escape the "%" again.
 */
export function GetLegacyImageFromAnime(anime: AnimePart | any): string {
  if (!anime) return "";
  const titleEn = anime.titleEn ?? anime.title_en;
  const titleJp = anime.titleJp ?? anime.title_jp;
  const title = titleEn || titleJp;
  if (!title) return "";
  return escapeUri(title.toLowerCase().replace(/ /g, "_"));
}

/**
 * Poster candidates in priority order: the id-keyed object, then the legacy
 * title-keyed one. SafeImage races them and takes the first that decodes.
 */
export function GetImageSourcesFromAnime(anime: AnimePart | any): string[] {
  const out: string[] = [];
  if (anime?.id) out.push(anime.id);
  const legacy = GetLegacyImageFromAnime(anime);
  if (legacy) out.push(legacy);
  return out.length > 0 ? out : ["not found.png"];
}

function escapeUri(str: string): string {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, char =>
      '%' + char.charCodeAt(0).toString(16).toUpperCase()
    );
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
