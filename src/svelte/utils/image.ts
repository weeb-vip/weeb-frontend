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

export function getSafeImageUrl(src: string, path?: string): string {
  const cdnUrl = getCdnUrl();
  // Replace %20 with + to match React SafeImage behavior exactly
  const encodedSrc = src.replace(/%20/g, "+");
  // Path handling - add trailing slash if path exists
  const pathPrefix = path ? `${path}/` : "";
  // Return the properly encoded URL - only single encodeURIComponent like React
  return `${cdnUrl}/${pathPrefix}${escapeUri(encodedSrc)}`;
}

function escapeUri(str) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, char =>
      '%' + char.charCodeAt(0).toString(16).toUpperCase()
    );
}
