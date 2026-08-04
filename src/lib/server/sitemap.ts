import { createSSRGraphQLClient } from './ssr-graphql';

// Sitemap data and XML assembly.
//
// The catalogue is ~32,000 anime, which is why this is a sitemap *index* rather than
// one file: Google caps a single sitemap at 50,000 URLs, and show pages plus news
// pages would crowd that ceiling. Chunking also keeps each response small enough to
// generate and cache comfortably.
//
// Everything here is cached in module scope. Building a chunk means listing the whole
// catalogue, and that is far too expensive to repeat per crawler request.

// URLs are built from the origin that served the request, never a hardcoded host: a
// sitemap served from staging must advertise staging URLs, or it points crawlers at a
// different deployment entirely.
export const ANIME_PER_SITEMAP = 10_000;

// Long, because the catalogue moves slowly and the query is expensive. The CDN
// cache in front of it is shorter, so a stale sitemap is never served for long.
const TTL_MS = 6 * 60 * 60 * 1000;

// Shorter: this set turns over as episodes air and seasons roll, and it is the one
// crawlers are asked to revisit most often, so a stale lastmod here costs more.
const AIRING_TTL_MS = 60 * 60 * 1000;

export interface SitemapEntry {
  loc: string;
  lastmod?: string | null;
}

interface Cached<T> {
  value: T;
  expires: number;
}

/**
 * Cached shape is host-independent — an id and a date, not a URL. Caching finished
 * URLs would key the whole catalogue to whichever origin happened to warm the cache.
 */
export interface SitemapRecord {
  id: string;
  lastmod: string | null;
}

let animeCache: Cached<SitemapRecord[]> | null = null;
let newsCache: Cached<SitemapRecord[]> | null = null;
let airingCache: Cached<SitemapRecord[]> | null = null;

/**
 * The API returns "2026-08-03 04:25:32" — not ISO 8601, and with no zone marker.
 * Rather than guess at a timezone and risk advertising a lastmod that is a day out,
 * this keeps the date only. A bare YYYY-MM-DD is valid W3C datetime, which is all
 * the sitemap spec asks for, and it is honest about the precision we actually have.
 */
export function toLastmod(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  return match ? match[1] : null;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderUrlset(entries: SitemapEntry[]): string {
  const urls = entries
    .map(({ loc, lastmod }) => {
      const parts = [`    <loc>${escapeXml(loc)}</loc>`];
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function renderIndex(entries: SitemapEntry[]): string {
  const maps = entries
    .map(({ loc, lastmod }) => {
      const parts = [`    <loc>${escapeXml(loc)}</loc>`];
      if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
      return `  <sitemap>\n${parts.join('\n')}\n  </sitemap>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${maps}\n</sitemapindex>\n`;
}

export { renderUrlset, renderIndex };

const ALL_ANIME_QUERY = `
  query SitemapAnime($limit: Int!) {
    newestAnime(limit: $limit) {
      id
      updatedAt
    }
  }
`;

const NEWS_PAGE_QUERY = `
  query SitemapNews($limit: Int!, $offset: Int!) {
    latestNews(limit: $limit, offset: $offset) {
      total
      items {
        animeId
        publishedDate
      }
    }
  }
`;

/**
 * The anime that matter most right now: airing today, plus everything in the current
 * season. Two sources because they are not the same set — `currentlyAiring` returned
 * 48 while the current season holds ~130, so a show between episodes falls out of the
 * first but not the second.
 */
const AIRING_QUERY = `
  query SitemapAiring($season: Season!) {
    currentlyAiring(limit: 500) { id updatedAt }
    animeBySeasons(season: $season, limit: 2000) { id updatedAt }
  }
`;

// newestAnime has no pagination, only a limit, so this asks for more than the
// catalogue holds and takes what comes back. Revisit if the catalogue approaches it.
const CATALOGUE_CEILING = 100_000;

// latestNews caps its page size at 100 regardless of what is requested.
const NEWS_PAGE_SIZE = 100;

// Guards the offset loop against an API that keeps reporting a total it will not serve.
const MAX_NEWS_PAGES = 200;

type Client = ReturnType<typeof createSSRGraphQLClient>;

export async function getAnimeRecords(client: Client): Promise<SitemapRecord[]> {
  if (animeCache && animeCache.expires > Date.now()) return animeCache.value;

  const res: any = await client.request(ALL_ANIME_QUERY, { limit: CATALOGUE_CEILING });
  const records: SitemapRecord[] = (res?.newestAnime ?? [])
    .filter((a: any) => a?.id)
    .map((a: any) => ({ id: a.id, lastmod: toLastmod(a.updatedAt) }));

  animeCache = { value: records, expires: Date.now() + TTL_MS };
  return records;
}

/**
 * Currently-airing and current-season anime, kept in their own sitemap.
 *
 * Note this is NOT done with <priority> or <changefreq>: Google states it ignores
 * both, so marking these 1.0 would achieve nothing. The value of a separate file is
 * that Search Console reports coverage per sitemap, so the ~180 pages that matter
 * this season can be seen to be indexed without their signal drowning in 32,000
 * others. What actually drives crawl priority is internal linking and an honest
 * lastmod, not sitemap metadata.
 */
export async function getAiringRecords(
  client: Client,
  season: string
): Promise<SitemapRecord[]> {
  if (airingCache && airingCache.expires > Date.now()) return airingCache.value;

  const res: any = await client.request(AIRING_QUERY, { season });

  const seen = new Map<string, string | null>();
  for (const a of [...(res?.currentlyAiring ?? []), ...(res?.animeBySeasons ?? [])]) {
    if (a?.id && !seen.has(a.id)) seen.set(a.id, toLastmod(a.updatedAt));
  }

  const records = [...seen.entries()].map(([id, lastmod]) => ({ id, lastmod }));
  airingCache = { value: records, expires: Date.now() + AIRING_TTL_MS };
  return records;
}

export function animeEntries(records: SitemapRecord[], siteUrl: string): SitemapEntry[] {
  return records.map(({ id, lastmod }) => ({ loc: `${siteUrl}/show/${id}`, lastmod }));
}

/**
 * News hub pages, for anime that actually have news.
 *
 * Deliberately not one per anime: /show/<id>/news exists for all ~32,000, but for the
 * vast majority it renders nothing. Submitting 32,000 empty pages is how a site earns
 * a thin-content reputation, so only anime with at least one story are listed.
 */
export async function getNewsRecords(client: Client): Promise<SitemapRecord[]> {
  if (newsCache && newsCache.expires > Date.now()) return newsCache.value;

  const newest = new Map<string, string | null>();
  let offset = 0;
  let total = Infinity;
  let pages = 0;

  while (offset < total && pages < MAX_NEWS_PAGES) {
    const res: any = await client.request(NEWS_PAGE_QUERY, {
      limit: NEWS_PAGE_SIZE,
      offset
    });
    const feed = res?.latestNews;
    const items: any[] = feed?.items ?? [];
    total = typeof feed?.total === 'number' ? feed.total : 0;

    for (const item of items) {
      if (!item?.animeId) continue;
      const lastmod = toLastmod(item.publishedDate);
      const current = newest.get(item.animeId);
      // The feed is newest-first, so the first date seen for an anime is its latest.
      if (current === undefined || (lastmod && current && lastmod > current)) {
        newest.set(item.animeId, lastmod ?? current ?? null);
      }
    }

    if (!items.length) break;
    offset += items.length;
    pages += 1;
  }

  const records: SitemapRecord[] = [...newest.entries()].map(([id, lastmod]) => ({
    id,
    lastmod
  }));

  newsCache = { value: records, expires: Date.now() + TTL_MS };
  return records;
}

export function newsEntries(records: SitemapRecord[], siteUrl: string): SitemapEntry[] {
  return records.map(({ id, lastmod }) => ({ loc: `${siteUrl}/show/${id}/news`, lastmod }));
}

/**
 * Season pages, discovered rather than hardcoded: the API only holds a couple of
 * years, and a hardcoded list would either go stale or advertise empty pages.
 */
export async function getSeasonEntries(
  client: Client,
  now: Date,
  siteUrl: string
): Promise<SitemapEntry[]> {
  const year = now.getUTCFullYear();
  const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  const candidates: string[] = [];
  for (const y of [year - 1, year, year + 1]) {
    for (const s of seasons) candidates.push(`${s}_${y}`);
  }

  const checked = await Promise.all(
    candidates.map(async (season) => {
      try {
        // `Season` is a custom scalar, not String — declaring $season as String!
        // fails validation and every season silently looks empty.
        const res: any = await client.request(
          `query SitemapSeason($season: Season!) { animeBySeasons(season: $season, limit: 1) { id } }`,
          { season }
        );
        return (res?.animeBySeasons ?? []).length > 0 ? season : null;
      } catch {
        return null;
      }
    })
  );

  return checked
    .filter((s): s is string => Boolean(s))
    .map((season) => ({ loc: `${siteUrl}/season/${season}` }));
}

/** Static pages worth indexing. Auth, profile and settings are deliberately absent. */
export const STATIC_PATHS = ['/', '/airing', '/airing/calendar', '/about'];

export function chunkCount(total: number): number {
  return Math.max(1, Math.ceil(total / ANIME_PER_SITEMAP));
}

export function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // Crawlers refetch sitemaps often; let the CDN carry that load.
      'cache-control': 'public, max-age=3600, s-maxage=21600'
    }
  });
}

/** Exposed for tests. */
export function _clearSitemapCache(): void {
  animeCache = null;
  newsCache = null;
  airingCache = null;
}
