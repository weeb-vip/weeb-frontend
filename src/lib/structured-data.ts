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
  titleKanji?: string | null;
  description?: string | null;
  episodeCount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  duration?: string | null;
  tags?: string[] | null;
  studios?: string[] | null;
  malId?: number | null;
  episodes?: EpisodeLike[] | null;
}

export interface EpisodeLike {
  episodeNumber?: number | null;
  titleEn?: string | null;
  titleJp?: string | null;
  airDate?: string | null;
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
 * The catalogue is mostly — but not only — Japanese, so the language is inferred from
 * the script of the native title rather than asserted. Kana are unique to Japanese and
 * Hangul to Korean; Han characters with neither belong to a Chinese title (donghua).
 *
 * With no native title there is nothing to read, and 'ja' is the honest prior for an
 * anime catalogue. That is the value this function replaced, so the fallback is never
 * worse than what it used to emit unconditionally.
 */
export function inferLanguage(anime: AnimeLike): string {
  const native = anime.titleJp || anime.titleKanji || '';
  if (/[\uAC00-\uD7AF]/.test(native)) return 'ko';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(native)) return 'ja';
  if (/[\u4E00-\u9FFF]/.test(native)) return 'zh';
  return 'ja';
}

/**
 * Long-runners would otherwise put a thousand episodes into every page's <head>. The
 * cap keeps the block small; the tail is kept rather than the head because the episodes
 * worth describing are the ones currently airing, not the ones from 1999.
 */
const MAX_LISTED_EPISODES = 100;

/**
 * TVEpisode entries for the episodes the page already loaded.
 *
 * `datePublished` is only set for episodes that have actually aired — it means
 * "was published", and claiming it for a future broadcast is simply false. The
 * scheduled time is carried by `publication` instead, which is what BroadcastEvent
 * is for and is valid for past and future alike.
 */
export function episodeSchemas(
  episodes: EpisodeLike[] | null | undefined,
  now: Date = new Date()
): Record<string, unknown>[] {
  if (!episodes?.length) return [];

  const today = now.toISOString().slice(0, 10);

  return episodes
    .filter((e) => typeof e.episodeNumber === 'number')
    .sort((a, b) => (a.episodeNumber as number) - (b.episodeNumber as number))
    .slice(-MAX_LISTED_EPISODES)
    .map((e) => {
      const aired = schemaDate(e.airDate);
      return clean({
        '@type': 'TVEpisode',
        episodeNumber: e.episodeNumber,
        name: e.titleEn || e.titleJp || null,
        datePublished: aired && aired <= today ? aired : null,
        publication: aired
          ? { '@type': 'BroadcastEvent', startDate: aired, isLiveBroadcast: false }
          : null
      });
    });
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
    inLanguage: inferLanguage(anime),
    // Episode counts are meaningless on a film.
    numberOfEpisodes: isMovie ? null : (anime.episodeCount ?? null),
    // A film has no episodes to list; clean() drops the key when there are none.
    episode: isMovie ? [] : episodeSchemas(anime.episodes),
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

export interface ListItemLike {
  slug?: string | null;
  titleEn?: string | null;
  titleJp?: string | null;
  imageUrl?: string | null;
}

/**
 * ItemList for a page that is a list of shows — a season, or the airing schedule.
 *
 * These are the pages with a real chance of ranking: "summer 2026 anime" is a query
 * with volume, where a show page is competing against MyAnimeList for a title nobody
 * searches by name. The list is what the page IS, so it is what gets described.
 *
 * No carousel comes of this. Google only builds those from Movie, Recipe, Course and
 * Restaurant, and TVSeries is not on the list — the value here is telling a crawler
 * that the page is a curated set of identified entities, not the rich result.
 *
 * Entries without a slug are dropped rather than linked by id: /show/<id> answers with
 * a redirect to the slug, and a list of redirects is a worse signal than a shorter list.
 */
export function itemListSchema(
  items: ListItemLike[] | null | undefined,
  { name, url, siteUrl }: { name: string; url: string; siteUrl: string }
): Record<string, unknown> | null {
  if (!items?.length) return null;

  const elements = items
    .filter((a) => Boolean(a.slug))
    .map((a, i) =>
      clean({
        '@type': 'ListItem',
        position: i + 1,
        url: `${siteUrl}/anime/${a.slug}`,
        name: a.titleEn || a.titleJp || null,
        image: a.imageUrl || null
      })
    );

  if (!elements.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url,
    numberOfItems: elements.length,
    itemListElement: elements
  };
}

/**
 * Serialise for embedding in a <script> tag. `<` is escaped so a description
 * containing "</script>" cannot break out of the block.
 */
export function serializeJsonLd(schema: unknown): string {
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}
