/**
 * The avatar's two rules: which CDN variant to ask for, and which classes the
 * circle takes at each size.
 *
 * Both had drifted into two copies before this component absorbed
 * ProfileHeroAvatar, which is why they are written once, here.
 */

export type ProfileAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

/** The CDN base used when neither a ConfigProvider nor the config store has one. */
export const DEFAULT_CDN_USER_URL = 'https://cdn.weeb.vip/users';

/**
 * `xl` has no fixed size: the profile hero sizes its own wrapper (120px on
 * desktop, 108px on the public page, 88/72px down the breakpoints) and the
 * circle fills it.
 */
const SIZE_CLASSES: Record<ProfileAvatarSize, string> = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-full h-full'
};

/**
 * The CDN thumbnail to ask for: the smallest variant that is not smaller
 * than the box it is drawn in. `md` used to take `_32` into a 40px circle,
 * so the nav avatar was upscaled even at 1x.
 *
 * `xl` takes no suffix at all -- the original. A `_64` in a 120px circle is
 * what made a second component look necessary.
 */
const CDN_SUFFIX: Record<ProfileAvatarSize, string> = {
  sm: '_32',
  md: '_64',
  lg: '_64',
  xl: ''
};

/** The username's first letter, unless the caller named the initials itself. */
export function initialFor(initials: string | null, username: string): string {
  return initials || (username ? username.charAt(0).toUpperCase() : '?');
}

/**
 * A ready-built URL wins: the profile blocs already resolved it against their
 * own CDN base, and re-deriving it here would be a second answer. Otherwise the
 * size suffix goes in before the file extension.
 */
export function avatarImageUrl(
  src: string | null,
  profileImageUrl: string | null,
  size: ProfileAvatarSize,
  cdnUserUrl: string
): string | undefined {
  if (src) return src;
  if (!profileImageUrl) return undefined;

  const suffix = CDN_SUFFIX[size];
  const lastDotIndex = profileImageUrl.lastIndexOf('.');
  if (lastDotIndex === -1) return `${cdnUserUrl}/${profileImageUrl}${suffix}`;

  const nameWithoutExt = profileImageUrl.substring(0, lastDotIndex);
  const extension = profileImageUrl.substring(lastDotIndex);
  return `${cdnUserUrl}/${nameWithoutExt}${suffix}${extension}`;
}

export function avatarClasses(size: ProfileAvatarSize, className: string): string {
  return size === 'xl'
    ? `${SIZE_CLASSES.xl} ${className}`
    : `${SIZE_CLASSES[size]} rounded-full flex items-center justify-center font-semibold cursor-pointer transition-all duration-300 hover:ring-2 hover:ring-weeb-accent hover:ring-offset-2 ${className}`;
}
