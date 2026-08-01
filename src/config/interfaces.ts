export interface IConfig {
  api_host: string;
  graphql_host: string;
  algolia_index: string;
  cdn_url: string;
  cdn_user_url: string;
  posthog_api_key?: string;
  /** Deployment environment: "production", "staging", "development", or "local" —
   * one per config under static/. Tagged on every PostHog event and used for
   * feature-flag targeting.
   *
   * Every config sets it, so the `|| 'production'` fallback in global-ui.ts is now
   * only reachable via a malformed config. Keep it set when adding a config: an
   * environment that falls back reports itself as production, which both mistags
   * its events and matches production-targeted flags. */
  environment?: string;
  /** Enable Cloudflare Image Resizing (/cdn-cgi/image/) on CDN URLs. Production only —
   * staging is not fronted by Cloudflare, so transforms would 404 there. */
  cdn_image_resize?: boolean;
}
