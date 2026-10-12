import { configStore } from '$lib/stores/config';

export function getCdnUrl(): string {
  // Try to get from Svelte config store first
  const config = configStore.get();
  if (config?.cdn_url) {
    return config.cdn_url;
  }

  // Fallback to window.global for compatibility
  if (typeof window !== 'undefined' && (window as any).global?.config?.cdn_url) {
    return (window as any).global.config.cdn_url;
  }

  return 'https://cdn.weeb.vip/weeb';
}

/**
 * Build a CDN URL for an image key.
 *
 * `src` is a record id (anime, character, ...), which is what objects are keyed
 * by. It used to be a title-derived slug that had already been escaped once by
 * the caller, so this escaped it a *second* time to match how the object was
 * actually stored — the source of a long tail of 404s for any title containing
 * a `:` or `(`. Ids need no such dance; one encode is both correct and a no-op.
 */
export function getSafeImageUrl(src: string, path?: string): string {
  const cdnUrl = getCdnUrl();
  const pathPrefix = path ? `${path}/` : "";
  return `${cdnUrl}/${pathPrefix}${encodeURIComponent(src)}`;
}

/** True only when the loaded config opts in (production, which is Cloudflare-fronted). */
function isCdnResizeEnabled(): boolean {
  const config = configStore.get();
  if (config) return config.cdn_image_resize === true;
  // SSR/pre-config fallback: window global mirrors the layout config
  if (typeof window !== 'undefined') {
    return (window as any).global?.config?.cdn_image_resize === true;
  }
  return false;
}

/** The resizer's encoder quality when the caller names none. */
export const DEFAULT_CDN_QUALITY = 85;

/**
 * Route a CDN image URL through Cloudflare Image Resizing when enabled:
 *   https://cdn.weeb.vip/weeb/<slug>
 *     -> https://cdn.weeb.vip/cdn-cgi/image/width=W,format=auto,quality=85,fit=cover/weeb/<slug>
 * `width` is the device-pixel width wanted; `quality` the encoder quality,
 * lowered only for a visitor who asked to save data (see $lib/stores/image-policy).
 * Returns the URL unchanged when resizing is disabled, the URL isn't a CDN URL,
 * already transformed, or unparseable — so it is always safe to call.
 */
export function resizeCdnUrl(url: string, width: number, { quality = DEFAULT_CDN_QUALITY }: { quality?: number } = {}): string {
  if (!width || !isCdnResizeEnabled()) return url;
  if (!/^https?:\/\//i.test(url)) return url; // local assets (fallbacks) pass through
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('cdn.weeb.vip')) return url;
    if (u.pathname.startsWith('/cdn-cgi/image/')) return url; // don't double-transform
    const opts = `width=${Math.round(width)},format=auto,quality=${Math.round(quality)},fit=cover`;
    return `${u.origin}/cdn-cgi/image/${opts}${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}


/**
 * The width variants the image pipeline stores beside each object, per CDN
 * folder, and the width of the object at the key itself. Mirrors
 * upscaler-service's DefaultVariants and DefaultDisplayWidths; the pipeline
 * writes `<key>-w320` and so on, so a card can ask for the width it draws
 * instead of the full display copy.
 */
export const STORED_VARIANTS: Record<string, { cap: number; widths: number[] }> = {
  '': { cap: 600, widths: [320] },
  posters: { cap: 1000, widths: [320, 640] },
  works: { cap: 1000, widths: [320, 640] },
  characters: { cap: 600, widths: [160] },
  staff: { cap: 600, widths: [160] },
  banners: { cap: 1920, widths: [960] }
};

/** True when the config says the bucket carries the stored variants. */
export function isStoredVariantsEnabled(): boolean {
  const config = configStore.get();
  if (config) return config.cdn_stored_variants === true;
  if (typeof window !== 'undefined') {
    return (window as any).global?.config?.cdn_stored_variants === true;
  }
  return false;
}

/**
 * The stored variants of a CDN object URL: `[{url, width}]` for each width
 * the pipeline writes for that folder, plus the object itself at its cap.
 * Null for anything that is not a CDN object (a local asset, a resized URL,
 * a user upload), or when the config has not turned the variants on.
 */
export function storedVariantsFor(url: string): { url: string; width: number }[] | null {
  if (!isStoredVariantsEnabled()) return null;
  const base = getCdnUrl();
  if (!url.startsWith(base + '/')) return null;
  const rest = url.slice(base.length + 1);
  if (rest.includes('/cdn-cgi/') || /-w\d+$/.test(rest)) return null;
  const parts = rest.split('/');
  const folder = parts.length > 1 ? parts[0] : '';
  const spec = STORED_VARIANTS[folder];
  if (!spec) return null;
  return [...spec.widths.map((w) => ({ url: `${url}-w${w}`, width: w })), { url, width: spec.cap }];
}
