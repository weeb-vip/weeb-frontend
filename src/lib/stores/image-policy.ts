import { getContext, setContext } from 'svelte';

/**
 * How hard to squeeze the images on this request.
 *
 * The CDN keeps a full-size master and Cloudflare Image Resizing hands each
 * device the pixels it will show, so nobody pays for resolution they cannot
 * see. The one case where fewer bytes beats fidelity is a visitor who asked
 * for it: the `Save-Data: on` header (data saver on the phone or in the
 * browser). For them the quality drops and the candidate widths are capped;
 * everyone else keeps the defaults. Per request, as Svelte context, like the
 * server's auth answer -- never a module-level store, which SSR would share
 * between visitors.
 */
export interface ImagePolicy {
  /** The resizer's `quality=` (JPEG/WebP/AVIF encoder quality). */
  quality: number;
  /** The widest variant to ask for, or null for no cap. */
  maxWidth: number | null;
  /**
   * Whether to go through the resizer at all. Off while it is refusing
   * (its monthly cap, ERROR 9422): every image then starts from the raw
   * object instead of a request that fails first, and a page with no script
   * shows artwork at all. See CDN_IMAGE_RESIZE in hooks.server.ts.
   */
  resize: boolean;
}

export const DEFAULT_IMAGE_POLICY: ImagePolicy = { quality: 85, maxWidth: null, resize: true };

/**
 * Quality 60 is where AVIF and WebP still look fine on a phone and weigh
 * about half of 85; 640px covers a 2x poster card and a 1x phone hero.
 */
export const SAVE_DATA_POLICY: ImagePolicy = { quality: 60, maxWidth: 640, resize: true };

export function imagePolicyFor(
  saveData: boolean | null | undefined,
  resize: boolean | null | undefined = true
): ImagePolicy {
  const base = saveData ? SAVE_DATA_POLICY : DEFAULT_IMAGE_POLICY;
  return resize === false ? { ...base, resize: false } : base;
}

const KEY = 'weeb:image-policy';

/** Called once by the root layout, during its init. */
export function provideImagePolicy(policy: ImagePolicy): void {
  setContext(KEY, policy);
}

/** The policy in force, or the default outside a component tree (stories, tests). */
export function imagePolicyFromContext(): ImagePolicy {
  try {
    return getContext<ImagePolicy | undefined>(KEY) ?? DEFAULT_IMAGE_POLICY;
  } catch {
    return DEFAULT_IMAGE_POLICY;
  }
}

/** The width to request under a policy: the cap, where there is one. */
export function cappedWidth(width: number, policy: ImagePolicy): number {
  return policy.maxWidth ? Math.min(width, policy.maxWidth) : width;
}
