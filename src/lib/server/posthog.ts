/**
 * Server-side PostHog feature-flag evaluation.
 *
 * Client-only flag checks (`window.posthog.isFeatureEnabled`) can't gate
 * server-rendered content — the client flag load races hydration, so a flag
 * that's on can still render nothing on first paint. Evaluating here, in a
 * SvelteKit `load`, bakes the decision into the SSR HTML.
 *
 * Usage from a `+page.server.ts` / `+layout.server.ts` load:
 *   import { isFeatureEnabled, getFeatureFlags } from '$lib/server/posthog';
 *   const enabled = await isFeatureEnabled('my-flag', config, cookies);
 *   const flags   = await getFeatureFlags(['a', 'b'], config, cookies); // one call
 */
import type { Cookies } from '@sveltejs/kit';
import type { IConfig } from '../../config/interfaces';

const POSTHOG_HOST = 'https://us.i.posthog.com';

type FlagMap = Record<string, boolean | string>;

/**
 * Reuse the visitor's PostHog distinct_id (from the `ph_<key>_posthog` cookie)
 * so rollout bucketing stays consistent with the client; fall back to an
 * anonymous id otherwise.
 *
 * The cookie value is URL-encoded JSON, so it must be decoded before parsing.
 * The fallback deliberately avoids `crypto.randomUUID()` — it isn't guaranteed
 * in every edge runtime/compat-date, and throwing here would sink the whole
 * flag lookup. The value only matters for percentage-rollout bucketing.
 */
function distinctIdFrom(apiKey: string, cookies: Cookies): string {
  const raw = cookies.get(`ph_${apiKey}_posthog`);
  if (raw) {
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (parsed?.distinct_id) return parsed.distinct_id as string;
    } catch {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.distinct_id) return parsed.distinct_id as string;
      } catch {
        /* malformed cookie — fall through to an anonymous id */
      }
    }
  }
  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** One `/decide` round-trip → the raw flag map (empty on missing key/error). */
async function decide(config: IConfig, cookies: Cookies): Promise<FlagMap> {
  const apiKey = config?.posthog_api_key;
  if (!apiKey) return {};

  const res = await fetch(`${POSTHOG_HOST}/decide/?v=3`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      distinct_id: distinctIdFrom(apiKey, cookies),
      // `environment` powers env-scoped flag targeting (staging vs production)
      person_properties: { environment: config?.environment || 'production' }
    })
  });
  if (!res.ok) return {};
  const data: any = await res.json();
  return (data?.featureFlags as FlagMap) ?? {};
}

/** Evaluate a single feature flag server-side. Returns false on any error. */
export async function isFeatureEnabled(
  flagKey: string,
  config: IConfig,
  cookies: Cookies
): Promise<boolean> {
  try {
    const flags = await decide(config, cookies);
    return !!flags[flagKey];
  } catch (err) {
    console.warn(`[posthog] isFeatureEnabled(${flagKey}) failed:`, err);
    return false;
  }
}

/**
 * Evaluate several flags in a single `/decide` call. Returns a map of
 * key → boolean, defaulting every requested key to false on error.
 */
export async function getFeatureFlags(
  flagKeys: string[],
  config: IConfig,
  cookies: Cookies
): Promise<Record<string, boolean>> {
  try {
    const flags = await decide(config, cookies);
    return Object.fromEntries(flagKeys.map((k) => [k, !!flags[k]]));
  } catch {
    return Object.fromEntries(flagKeys.map((k) => [k, false]));
  }
}
