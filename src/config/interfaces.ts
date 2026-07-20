export interface IConfig {
  api_host: string;
  graphql_host: string;
  algolia_index: string;
  cdn_url: string;
  cdn_user_url: string;
  posthog_api_key?: string;
  /** Enable Cloudflare Image Resizing (/cdn-cgi/image/) on CDN URLs. Production only —
   * staging is not fronted by Cloudflare, so transforms would 404 there. */
  cdn_image_resize?: boolean;
}
