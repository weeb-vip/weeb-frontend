import { getSafeImageUrl } from '$lib/utils/image';
import { PHONE_QUERY, DESKTOP_QUERY } from '$lib/stores/viewport';
import { orderedSources } from '$lib/components/primitives/SafeImage/SafeImage.logic';
import { DEFAULT_IMAGE_POLICY, type ImagePolicy } from '$lib/stores/image-policy';

/**
 * The hero's artwork candidates, as two orderings the browser picks between
 * by viewport.
 *
 * Both are keyed by anime id: banners/<id> for TheTVDB's wide artwork synced
 * by thetvdb-enrichment, posters/<id> for its 680x1000 series poster, and <id>
 * at the bucket root for the scraper's 225px MyAnimeList image -- the last
 * resort at hero scale rather than a peer of the other two.
 *
 * Two lists rather than one picked from `matchMedia`: the server has no
 * viewport, so a single list meant every phone first received the desktop
 * banner in its HTML and then swapped to the poster after hydration, paying
 * for both. A <picture> source carrying the phone list lets the browser choose
 * before any script runs, and the preload hint carries the same media query.
 */
export type ImageUrl = (id: string, path?: string) => string;

/** Wide box: the banner is composed for this shape. A poster cropped to a
 * wide frame still beats a 225px image blown up to fill it. */
export function heroSources(id: string, imageUrl: ImageUrl = getSafeImageUrl): string[] {
  return [imageUrl(id, 'banners'), imageUrl(id, 'posters'), imageUrl(id)];
}

/** Tall box: prefer tall art, and prefer the high-resolution one. */
export function heroPhoneSources(id: string, imageUrl: ImageUrl = getSafeImageUrl): string[] {
  return [imageUrl(id, 'posters'), imageUrl(id), imageUrl(id, 'banners')];
}

/** Device-pixel widths asked of the CDN. A phone never needs 1600px of hero art. */
export const HERO_CDN_WIDTH = 1600;
export const HERO_PHONE_CDN_WIDTH = 800;

export type HeroPreload = { href: string; media: string };

/**
 * `<link rel="preload" as="image">` hints for the hero, one per viewport.
 *
 * Each is the exact URL SafeImage puts first for that viewport -- resized
 * through the CDN where the config enables it -- or the hint warms the wrong
 * bytes and the real request still starts from the HTML parse. The media
 * query keeps a phone from preloading the desktop banner and vice versa.
 */
export function heroPreloads(
  id: string | null | undefined,
  imageUrl: ImageUrl = getSafeImageUrl,
  policy: ImagePolicy = DEFAULT_IMAGE_POLICY
): HeroPreload[] {
  if (!id) return [];
  const [desktop] = orderedSources(heroSources(id, imageUrl), '', '', HERO_CDN_WIDTH, policy);
  const [phone] = orderedSources(heroPhoneSources(id, imageUrl), '', '', HERO_PHONE_CDN_WIDTH, policy);
  const out: HeroPreload[] = [];
  if (desktop) out.push({ href: desktop, media: DESKTOP_QUERY });
  if (phone) out.push({ href: phone, media: PHONE_QUERY });
  return out;
}
