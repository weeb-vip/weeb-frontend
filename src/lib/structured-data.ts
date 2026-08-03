// schema.org JSON-LD builders.
//
// Everything here is derived from data the page already loads — no new queries, no
// new storage. The point is to restate what is on the page in a form Google can use
// for rich results (episode counts, air dates, breadcrumb trails in the SERP).

export interface AnimeLike {
  id?: string | null;
  titleEn?: string | null;
  titleJp?: string | null;
  titleRomaji?: string | null;
  description?: string | null;
  episodeCount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  duration?: string | null;
  tags?: string[] | null;
  studios?: string[] | null;
  malId?: number | null;
}

/** A date the way schema.org wants it: YYYY-MM-DD, no time, no zone guessing. */
function schemaDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw).trim());
  return m ? m[1] : null;
}

/**
 * "23 min. per ep." -> "PT23M". Anything unparseable is dropped rather than guessed:
 * an invalid duration is worse than an absent one.
 */
export function isoDuration(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const h = /(\d+)\s*hr/i.exec(raw);
  const m = /(\d+)\s*min/i.exec(raw);
  if (!h && !m) return null;
  return `PT${h ? `${h[1]}H` : ''}${m ? `${m[1]}M` : ''}`;
}

function clean<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
      delete obj[k];
    }
  }
  return obj;
}

/**
 * TVSeries (or Movie for a single-episode entry) describing one anime.
 *
 * Two fields are deliberately NOT mapped:
 *
 * - `rating` holds a MyAnimeList score like "6.7". It is tempting to emit it as
 *   contentRating, but contentRating means "PG-13" — a content advisory, not a score.
 * - As aggregateRating it would need ratingCount or reviewCount, which the API does
 *   not expose. Google rejects aggregateRating without a count, so emitting one would
 *   invalidate the whole block rather than add a star rating.
 */
export function animeSchema(
  anime: AnimeLike,
  canonicalUrl: string,
  imageUrl: string
): Record<string, unknown> | null {
  const name = anime.titleEn || anime.titleJp;
  if (!name) return null;

  // No explicit type on the record, so infer: a single-episode entry is a film.
  const isMovie = anime.episodeCount === 1;

  const alternateNames = [anime.titleJp, anime.titleRomaji].filter(
    (t): t is string => Boolean(t) && t !== name
  );

  return clean({
    '@context': 'https://schema.org',
    '@type': isMovie ? 'Movie' : 'TVSeries',
    name,
    alternateName: alternateNames.length === 1 ? alternateNames[0] : alternateNames,
    description: anime.description || null,
    url: canonicalUrl,
    image: imageUrl,
    genre: anime.tags ?? [],
    inLanguage: 'ja',
    // Episode counts are meaningless on a film.
    numberOfEpisodes: isMovie ? null : (anime.episodeCount ?? null),
    startDate: schemaDate(anime.startDate),
    endDate: schemaDate(anime.endDate),
    timeRequired: isoDuration(anime.duration),
    productionCompany: (anime.studios ?? []).map((s) => ({
      '@type': 'Organization',
      name: s
    })),
    // The disambiguator. 2,301 anime in the catalogue share a title with another, so
    // name alone cannot identify an entity — the MyAnimeList URL can.
    sameAs: anime.malId ? `https://myanimelist.net/anime/${anime.malId}` : null
  });
}

export interface Crumb {
  name: string;
  url: string;
}

/** BreadcrumbList. Derived purely from the path — needs no data of its own. */
export function breadcrumbSchema(crumbs: Crumb[]): Record<string, unknown> | null {
  if (!crumbs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url
    }))
  };
}

/**
 * Serialise for embedding in a <script> tag. `<` is escaped so a description
 * containing "</script>" cannot break out of the block.
 */
export function serializeJsonLd(schema: unknown): string {
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}
