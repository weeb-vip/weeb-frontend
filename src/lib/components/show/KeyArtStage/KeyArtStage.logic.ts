import { getSafeImageUrl } from '$lib/utils/image';

/**
 * The banner's candidates, in priority order: the wide key art if the record
 * has one, then the poster behind it. SafeImage stops at the first that loads,
 * so a show with no banner still fills the stage rather than showing nothing.
 */
export function bannerSourcesFor(imageId: string | null | undefined): string[] {
  return imageId ? [getSafeImageUrl(imageId, 'banners'), getSafeImageUrl(imageId)] : [];
}
