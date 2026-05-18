import debug from "../utils/debug";

interface AnimePart {
  titleEn?: string;
  titleJp?: string;
  title_en?: string;
  title_jp?: string;
}
export function GetImageFromAnime(anime: AnimePart | any): string {
  if (!anime) {
    return "not found.png";
  }
  if (anime.title_en) {
    anime.titleEn = anime.title_en;
  }
  if (anime.title_jp) {
    anime.titleJp = anime.title_jp;
  }
  return `${escapeUri((anime.titleEn ? anime.titleEn.toLowerCase().replace(/ /g, "_") : anime.titleJp?.toLowerCase().replace(/ /g, "_")) || "")}`;
}


function escapeUri(str) {
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
