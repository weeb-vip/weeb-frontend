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
 * The URL of a series page.
 *
 * The TheTVDB id is the key and the slug is decoration: only the leading digits
 * are parsed, so the readable half can change -- or be missing entirely -- and
 * the link still resolves. That is deliberate. A series has no name of its own
 * in our data, so the slug is borrowed from whichever entry currently opens it,
 * and borrowing something mutable to build a permanent URL is only safe if the
 * URL does not depend on it.
 */
export function seriesHref(seriesId: string | null | undefined, slug?: string | null): string {
  if (!seriesId) return "";

  return slug ? `/series/${seriesId}-${slug}` : `/series/${seriesId}`;
}

/**
 * Drops the later halves of a split-cour season, keeping the original.
 *
 * MyAnimeList files each broadcast run separately, so a season shown in two
 * cours is two anime -- "Attack on Titan Season 3" and "Season 3 Part 2" are
 * one season of one show. TheTVDB keeps them together, and that is the signal
 * used here: same series, same season, and every entry a TV run. Titles are not
 * consulted, because they do not carry it. "Durarara!! x2 Shou / Ten / Ketsu"
 * says nothing about parts, and both halves of SAO's War of Underworld and of
 * JoJo's Stardust Crusaders are filed under identical titles. A "Part N" string
 * match finds 141 anime of which only 31 share a season, so it would miss those
 * and fire on unrelated ones.
 *
 * Only whole-TV seasons collapse. A season holding a TV run and a special is
 * not a split cour -- it is a show and its extras, and hiding the extras would
 * lose them.
 *
 * `keepIds` is how the anime being viewed survives. Someone reading the page
 * for Part 2 still has to see where they are, even though the list no longer
 * offers Part 2 as a destination.
 */
export function collapseSeasonParts(entries: any[], keepIds: string[] = []): any[] {
  const keep = new Set(keepIds.filter(Boolean));
  const bySeason = new Map<number, any[]>();

  for (const entry of entries) {
    const season = entry?.seasonNumber;
    // Null is "we do not know" and 0 is the specials season. Neither is a
    // broadcast run that can be split, so both are left alone.
    if (season === null || season === undefined || season === 0) continue;
    if (!bySeason.has(season)) bySeason.set(season, []);
    bySeason.get(season)!.push(entry);
  }

  const dropped = new Set<string>();
  for (const group of bySeason.values()) {
    if (group.length < 2) continue;
    if (!group.every((e) => (e.type || "").toLowerCase() === "tv")) continue;

    const ordered = [...group].sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    // The original is the one that aired first; everything after it is a later
    // half of the same season.
    for (const entry of ordered.slice(1)) {
      if (!keep.has(entry.id)) dropped.add(entry.id);
    }
  }

  return entries.filter((entry) => !dropped.has(entry?.id));
}

/**
 * The series page for an anime, or "" when it belongs to no series we know.
 *
 * Derives the readable half of the URL from the same-series list the show page
 * already holds, so nothing extra is fetched. The anchor is the earliest TV
 * entry -- whichever entry gives the series its name -- falling back to the
 * earliest of anything for series that never had a TV run.
 *
 * One function rather than one per caller: the hero and the same-series
 * heading both link here, and two copies of "which entry names this series"
 * would eventually disagree and produce two URLs for one page.
 */
export function seriesLinkFor(anime: any): string {
  if (!anime?.thetvdbid) return "";

  const sameSeries = (anime.relatedAnime || [])
    .filter((entry: any) => entry?.relation === "SAME_SERIES" && entry.anime)
    .map((entry: any) => entry.anime);

  const candidates = [...sameSeries, anime].sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  const anchor =
    candidates.find((e: any) => (e.type || "").toLowerCase() === "tv") || candidates[0];

  return seriesHref(anime.thetvdbid, anchor?.slug);
}

/**
 * Which season of its series an anime is, as a reader-facing label.
 *
 * Null and 0 are different answers and must not collapse: null is "we do not
 * know" and shows nothing, while 0 is TheTVDB's specials season. A truthiness
 * check would render neither, which is why this tests for null explicitly.
 *
 * Season 0 is not redundant with an anime's type, which was the tempting
 * assumption: of the 1,151 anime we hold in season 0, 583 are typed OVA, Movie,
 * ONA, TV, Music or PV rather than as a special. Hiding it would lose real
 * information on more than half of them.
 */
export function seasonLabel(season: number | null | undefined): string {
  if (season === null || season === undefined) return "";

  return season === 0 ? "Special" : `Season ${season}`;
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
