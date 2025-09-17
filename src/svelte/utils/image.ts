import type {IConfig} from "../../config/interfaces.ts";

export function getImageFromAnime(anime: any): string {
  if (!anime) {
    return "not found.png";
  }
  if (anime.title_en) {
    anime.titleEn = anime.title_en;
  }
  if (anime.title_jp) {
    anime.titleJp = anime.title_jp;
  }

  const name = anime.titleEn || anime.titleJp || anime.name || "not found";
  return name;
}

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

  return 'https://cdn.weeb.vip/weeb-staging';
}

export function getSafeImageUrl(src: string, path?: string): string {
  const cdnUrl = getCdnUrl();
  // Replace %20 with + to match React SafeImage behavior
  const encodedSrc = src.toLowerCase().replace(/ /g, "_");
  // Path handling - add trailing slash if path exists
  const pathPrefix = path ? `${path}/` : "";
  // Return the properly encoded URL
  return `${cdnUrl}/${pathPrefix}${encodeURIComponent(escapeUri(encodedSrc))}`;
}

function escapeUri(str) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, char =>
      '%' + char.charCodeAt(0).toString(16).toUpperCase()
    );
}
