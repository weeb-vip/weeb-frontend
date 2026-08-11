// Resolves the best available share image for an anime.
//
// Three things were broken here, and all three have to be handled together:
//
//   1. The show page built `cdn.weeb.vip/weeb/<urlencoded imageUrl>`. `imageUrl` is a
//      MyAnimeList address; the CDN keys on a *slug* derived from the title, so that
//      URL 404s for every anime.
//   2. The CDN serves banners and posters as `application/octet-stream`. They are real
//      JPEGs, but Twitter/Facebook/Discord reject a non-image content type, so a card
//      renders blank even when the URL resolves. Routing through Cloudflare Image
//      Resizing re-encodes them and sets `image/jpeg`.
//   3. Neither a banner nor a poster exists for every anime (banners covered roughly
//      60% when this was written), so there has to be a real fallback — and
//      `/assets/og-image.jpg`, the previous default, did not exist in `public/` at all.
//
// Probing costs an HTTP round trip, so it happens here — in the `/og/[id].jpg`
// endpoint, which only crawlers hit — rather than during page render.

const RESIZE = 'width=1200,height=630,format=jpeg,quality=85,fit=cover';
const DEFAULT_OG = '/assets/og-image.jpg';

// Hits are stable; misses expire quickly so a newly synced banner is picked up
// without waiting out a long TTL.
const HIT_TTL_MS = 6 * 60 * 60 * 1000;
const MISS_TTL_MS = 10 * 60 * 1000;
// Shortest of the three: an inconclusive probe is not an answer, and the
// condition causing it (a bot challenge, a timeout) may clear at any moment.
const UNKNOWN_TTL_MS = 2 * 60 * 1000;

const cache = new Map<string, { url: string; expires: number }>();

/** Matches escapeUri in src/services/utils.ts and src/svelte/utils/image.ts. */
function escapeUri(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (char) => '%' + char.charCodeAt(0).toString(16).toUpperCase()
  );
}

/**
 * The CDN slug for an anime.
 *
 * Escaped TWICE, because that is how the objects are actually keyed. The client
 * builds a poster URL as getSafeImageUrl(GetImageFromAnime(anime)), and *both*
 * of those apply escapeUri — so a title containing `:` is stored under the
 * literal characters `%3A`, and requesting it means escaping the `%` in turn:
 *
 *   "Azumanga Daioh: The Animation"
 *     GetImageFromAnime -> azumanga_daioh%3A_the_animation
 *     getSafeImageUrl   -> azumanga_daioh%253A_the_animation   <- the real key
 *
 * Encoding only once yields a 404 for every title containing a character
 * escapeUri touches (`:`, `;`, `,`, `'`, `(`, `)`, ...), which is why those
 * shows fell through to the default share image while plain-ASCII titles like
 * "Destiny Unchain Online" — identical under one pass or two — worked fine.
 */
export function animeCdnSlug(title: string): string {
  const fromGetImageFromAnime = escapeUri(title.toLowerCase().replace(/ /g, '_'));
  // Mirrors getSafeImageUrl, including its %20 -> + step.
  return escapeUri(fromGetImageFromAnime.replace(/%20/g, '+'));
}

/**
 * Wrap a CDN URL in Cloudflare Image Resizing. This is what fixes the content type,
 * and it also makes the image exactly the 1200x630 that Seo.svelte declares — the
 * old tags advertised those dimensions for a portrait poster.
 */
function withResize(raw: string): string {
  try {
    const u = new URL(raw);
    if (!u.hostname.endsWith('cdn.weeb.vip')) return raw;
    if (u.pathname.startsWith('/cdn-cgi/image/')) return raw;
    return `${u.origin}/cdn-cgi/image/${RESIZE}${u.pathname}${u.search}`;
  } catch {
    return raw;
  }
}

/**
 * Three-state on purpose. "Missing" and "could not tell" call for different
 * fallbacks, and conflating them is how you end up advertising a 404.
 */
type Presence = 'present' | 'absent' | 'unknown';

/**
 * Does this object exist? Asks for a single byte: the CDN answers HEAD with 403,
 * and a full GET of a 300KB banner would be wasteful just to test presence.
 * Probes the untransformed URL — cheaper than making Cloudflare re-encode an
 * image we may not use.
 *
 * Cloudflare bot-challenges server-to-server requests for /weeb/*
 * (`cf-mitigated: challenge`) unless the caller looks like a verified crawler, so
 * without the WAF Skip rule this returns 'unknown' rather than a real answer.
 * Real crawlers are never challenged and fetch those URLs fine — it is only our
 * own probe that is blocked. `probeSecret` is what the Skip rule matches on.
 */
async function probe(
  url: string,
  fetchImpl: typeof fetch,
  probeSecret?: string | null
): Promise<Presence> {
  try {
    const res = await fetchImpl(url, {
      headers: {
        range: 'bytes=0-0',
        ...(probeSecret ? { 'x-og-probe': probeSecret } : {})
      },
      signal: AbortSignal.timeout(2500)
    });
    if (res.status === 200 || res.status === 206) return 'present';
    if (res.status === 404) return 'absent';
    return 'unknown';
  } catch {
    // Timeout or network error: no information either way.
    return 'unknown';
  }
}

export interface OgImageArgs {
  id: string;
  /**
   * Resolves the anime title, used to derive the CDN poster slug. Called lazily —
   * only when the banner is missing — so the common path costs no lookup.
   * Optional: without it, only the banner and the default are considered.
   */
  getTitle?: () => Promise<string | null>;
  /**
   * Sent as x-og-probe on every probe. Cloudflare challenges server-side requests
   * to /weeb/*, so a WAF Skip rule matching this header is what lets our own origin
   * check whether an image exists while the images stay bot-protected for everyone
   * else. Without the rule in place this is simply an ignored header.
   */
  probeSecret?: string | null;
  /** locals.config.cdn_url, which in production already includes the /weeb prefix. */
  cdnUrl?: string | null;
  /** Absolute origin, for resolving the local fallback asset. */
  origin: string;
  fetchImpl?: typeof fetch;
}

/**
 * Pick the share image for an anime.
 *
 * Order: CDN banner, CDN poster, branded default. Everything comes from our own
 * CDN — third-party artwork is deliberately not used as a fallback.
 *
 * Both CDN candidates are resized to exactly 1200x630, so whichever wins, and the
 * default too, the advertised dimensions are always honest.
 *
 * A probe that cannot get an answer resolves to the default rather than gambling
 * on a URL that might 404. Today that is production's normal state: Cloudflare
 * challenges server-side requests to /weeb/*, and it is per-environment — staging
 * runs as plain Node in k8s and is allowed, while production runs on Cloudflare
 * Pages and is challenged every time. That is exactly why staging showed real
 * artwork and production showed the placeholder.
 *
 * The WAF Skip rule matching `probeSecret` is what fixes it; the moment it lands,
 * both branches start resolving with no code change.
 */
export async function resolveOgImage({
  id,
  getTitle,
  probeSecret,
  cdnUrl,
  origin,
  fetchImpl = fetch
}: OgImageArgs): Promise<string> {
  const base = (cdnUrl || 'https://cdn.weeb.vip/weeb').replace(/\/+$/, '');
  const key = `${base}|${id}`;

  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.url;

  let chosen: string | null = null;
  let conclusive = true;

  // Banner first: it is 1920x1080, so it crops to 1200x630 without distortion.
  // The poster is portrait and only a reasonable card after a cover crop.
  const banner = `${base}/banners/${encodeURIComponent(id)}`;
  const bannerPresence = await probe(banner, fetchImpl, probeSecret);

  if (bannerPresence === 'present') {
    chosen = withResize(banner);
  } else if (bannerPresence === 'unknown') {
    // Whatever blocked this probe blocks the poster too — same origin, same rule.
    conclusive = false;
  } else if (getTitle) {
    // Only now is the title worth fetching: the poster is the sole remaining
    // candidate that needs it.
    const title = await getTitle().catch(() => null);
    if (title) {
      const poster = `${base}/${animeCdnSlug(title)}`;
      const posterPresence = await probe(poster, fetchImpl, probeSecret);
      if (posterPresence === 'present') chosen = withResize(poster);
      else if (posterPresence === 'unknown') conclusive = false;
    }
  }

  const url = chosen ?? new URL(DEFAULT_OG, origin).toString();
  // Don't cache a guess for hours — an inconclusive answer should be retried soon,
  // so banners appear promptly once probing is unblocked.
  const ttl = chosen ? HIT_TTL_MS : conclusive ? MISS_TTL_MS : UNKNOWN_TTL_MS;
  cache.set(key, { url, expires: Date.now() + ttl });
  return url;
}

/** Exposed for tests. */
export function _clearOgImageCache(): void {
  cache.clear();
}
