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

/** Matches escapeUri in src/services/utils.ts — the CDN keys are written with it. */
function escapeUri(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (char) => '%' + char.charCodeAt(0).toString(16).toUpperCase()
  );
}

/** The CDN slug for an anime, mirroring GetImageFromAnime. */
export function animeCdnSlug(title: string): string {
  return escapeUri(title.toLowerCase().replace(/ /g, '_'));
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
 * Cloudflare currently bot-challenges server-to-server requests for /weeb/*
 * (`cf-mitigated: challenge`), from this cluster included, so in production this
 * returns 'unknown' rather than a real answer. Real crawlers are not challenged
 * and fetch those URLs fine — it is only our own probe that is blocked. See the
 * note on resolveOgImage for what that means, and how to lift it.
 */
async function probe(url: string, fetchImpl: typeof fetch): Promise<Presence> {
  try {
    const res = await fetchImpl(url, {
      headers: { range: 'bytes=0-0' },
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

export interface AnimeImageSource {
  /** Used to derive the CDN poster slug. */
  title?: string | null;
  /** The MyAnimeList address. Reachable from anywhere — see resolveOgImage. */
  imageUrl?: string | null;
}

export interface OgImageArgs {
  id: string;
  /**
   * Resolves the anime's title and source image URL. Called lazily — only when the
   * banner is not immediately usable — so the common path costs no lookup.
   * Optional: without it, only the banner and the default are considered.
   */
  getSource?: () => Promise<AnimeImageSource | null>;
  /** locals.config.cdn_url, which in production already includes the /weeb prefix. */
  cdnUrl?: string | null;
  /** Absolute origin, for resolving the local fallback asset. */
  origin: string;
  fetchImpl?: typeof fetch;
}

/**
 * Pick the share image for an anime.
 *
 * Order: CDN banner, CDN poster, MyAnimeList poster, branded default.
 *
 * The last-but-one step exists because our own CDN cannot always be probed.
 * Cloudflare bot-challenges server-to-server requests to /weeb/* — and crucially
 * this is per-environment, not global: the staging pod's egress is allowed, while
 * production, which runs on Cloudflare Pages, is challenged for every request.
 * That is why staging showed real artwork and production showed the placeholder.
 *
 * MyAnimeList sits outside that zone, so `imageUrl` can be verified from anywhere.
 * It is a portrait poster rather than a 1920x1080 banner, so it makes a worse card
 * than the CDN banner — but real artwork beats a generic logo, and unlike the CDN
 * candidates it can actually be confirmed before being advertised.
 *
 * Once /weeb/* is exempted from the bot rule, the earlier CDN branches start
 * winning again on their own, with no code change.
 */
export async function resolveOgImage({
  id,
  getSource,
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
  const bannerPresence = await probe(banner, fetchImpl);

  if (bannerPresence === 'present') {
    chosen = withResize(banner);
  } else if (getSource) {
    const source = await getSource().catch(() => null);

    // Only worth trying when the banner gave a real answer. An inconclusive probe
    // means this origin is blocked for us, and the poster lives on that same origin.
    if (bannerPresence === 'absent' && source?.title) {
      const poster = `${base}/${animeCdnSlug(source.title)}`;
      const posterPresence = await probe(poster, fetchImpl);
      if (posterPresence === 'present') chosen = withResize(poster);
      else if (posterPresence === 'unknown') conclusive = false;
    }

    // Different origin, different rules — worth a try even when our own CDN
    // refused to answer.
    if (!chosen && source?.imageUrl) {
      if ((await probe(source.imageUrl, fetchImpl)) === 'present') {
        chosen = source.imageUrl;
        conclusive = true;
      }
    }
  }

  if (bannerPresence === 'unknown' && !chosen) conclusive = false;

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
