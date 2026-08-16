import { configStore } from '../stores/config';

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

/**
 * Route a CDN image URL through Cloudflare Image Resizing when enabled:
 *   https://cdn.weeb.vip/weeb/<slug>
 *     -> https://cdn.weeb.vip/cdn-cgi/image/width=W,format=auto,quality=85,fit=cover/weeb/<slug>
 * `width` is the intended device-pixel width (pass ~1.5-2x the CSS size for retina).
 * Returns the URL unchanged when resizing is disabled, the URL isn't a CDN URL,
 * already transformed, or unparseable — so it is always safe to call.
 */
export function resizeCdnUrl(url: string, width: number): string {
  if (!width || !isCdnResizeEnabled()) return url;
  if (!/^https?:\/\//i.test(url)) return url; // local assets (fallbacks) pass through
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('cdn.weeb.vip')) return url;
    if (u.pathname.startsWith('/cdn-cgi/image/')) return url; // don't double-transform
    const opts = `width=${Math.round(width)},format=auto,quality=85,fit=cover`;
    return `${u.origin}/cdn-cgi/image/${opts}${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}
