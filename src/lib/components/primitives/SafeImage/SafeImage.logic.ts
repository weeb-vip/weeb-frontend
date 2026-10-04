import { getSafeImageUrl, resizeCdnUrl } from '$lib/utils/image';

/**
 * SafeImage's rules, with no DOM state around them: which URLs to try and in
 * what order, whether a decoded image is a real one, and how to bound a single
 * attempt.
 *
 * The component keeps the state machine that walks this list (which candidate
 * won, whether the <img> has painted, the bfcache/visibility retries), because
 * that is lifecycle rather than a rule. Everything it *decides* is here.
 */

/** What `onChosen` reports: the URL that won, and why it was the one. */
export type ChosenDetail = {
  src: string | null;
  reason:
    | 'load'
    | 'last-source'
    | 'already-loaded'
    | 'retry-same'
    | 'same-already-loaded'
    | 'placeholder'
    | 'all-failed';
};

/** URLs that are already finished -- there is no CDN key to build from these. */
const ABSOLUTE = /^(?:https?:|data:|blob:)/i;

export const DEFAULT_REJECT_PATTERNS: RegExp[] = [
  /(?:^|\/)(?:404|not[-_]?found|error)\.(?:png|jpe?g|webp|gif|svg)$/i,
  /(?:^|\/)(?:placeholder|default)\.(?:png|jpe?g|webp|gif|svg)$/i
];

/**
 * A loaded image is only acceptable if its URL is not a known placeholder and
 * it is bigger than an error sprite.
 */
export function defaultAccept(
  img: { naturalWidth: number; naturalHeight: number },
  url: string,
  rejectPatterns: (string | RegExp)[] = DEFAULT_REJECT_PATTERNS
): boolean {
  for (const pat of rejectPatterns) {
    const re = typeof pat === 'string' ? new RegExp(pat) : pat;
    if (re.test(url)) return false;
  }
  if (img.naturalWidth <= 2 && img.naturalHeight <= 2) return false;
  return true;
}

/**
 * The candidates to try, in priority order.
 *
 * With a `cdnWidth`, CDN sources are routed through Cloudflare Image Resizing
 * and the untransformed URL is kept right behind each one. The transform is a
 * separate thing that can fail while the image behind it is perfectly fine, and
 * when it does every poster on the site becomes the not-found placeholder:
 *
 *     GET /cdn-cgi/image/width=360,.../weeb/<id>
 *     HTTP/2 429   cf-resized: err=9422
 *     ERROR 9422: Free unique transformations by account has been exhausted
 *
 * That is a monthly cap on unique transformations, so it recurs on a schedule
 * rather than being a one-off. Falling through to the original degrades the
 * page to full-size images -- more bytes than intended, but the artwork is
 * there -- instead of losing all of it.
 *
 * Only where the two differ: `resizeCdnUrl` returns its input unchanged when
 * resizing is off or the URL is not a CDN one, and a duplicate entry would just
 * be a second identical request.
 */
export function orderedSources(
  sources: string[],
  src: string,
  path: string,
  cdnWidth: number | undefined
): string[] {
  // Nothing named: no candidates, rather than a request for the CDN root.
  if (sources.length === 0 && !src) return [];
  const base =
    sources.length > 0
      ? sources.map((s) => (ABSOLUTE.test(s) ? s : getSafeImageUrl(s, path)))
      : [getSafeImageUrl(src, path)];

  if (!cdnWidth) return base;

  return base.flatMap((u) => {
    const resized = resizeCdnUrl(u, cdnWidth);
    return resized === u ? [u] : [resized, u];
  });
}

/**
 * Landing on a later candidate is not degradation, so only the LAST of several
 * is called out. This used to blur whenever the last source won -- reasonable
 * when the chain was [real image, not-found.jpg], and wrong the moment callers
 * pass genuine alternatives. A poster shelf asking for [tvdb poster, scraper
 * image] hits the second for every show TheTVDB does not carry.
 */
export function loadReason(index: number, total: number): 'load' | 'last-source' {
  return index === total - 1 && total > 1 ? 'last-source' : 'load';
}

/**
 * The URL SafeImage will put in the HTML for these inputs: what a
 * `<link rel="preload" as="image">` for the element has to name, or the hint
 * warms the wrong bytes.
 */
export function firstCandidate(sources: string[], cdnWidth?: number): string | null {
  return orderedSources(sources, '', '', cdnWidth)[0] ?? null;
}
