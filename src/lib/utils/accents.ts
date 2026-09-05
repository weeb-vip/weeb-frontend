/**
 * The accent palette a viewer can pick for their public page.
 *
 * A token name is what gets stored, never a raw colour, so a page can only ever
 * theme itself from this list. The OKLCH values live here rather than in the
 * design tokens because they are not part of the product's palette -- they are
 * the seven choices offered -- and here rather than in two components because
 * the picker (ProfileSettings) and the page it themes (PublicUserPage) have to
 * agree on what "violet" means.
 */

export interface AccentOption {
  /** Stored on the user, e.g. "violet". */
  name: string;
  label: string;
  /** The OKLCH the swatch shows and the public page applies. */
  value: string;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  { name: 'violet', label: 'Violet', value: 'oklch(55% 0.16 298)' },
  { name: 'blue', label: 'Blue', value: 'oklch(58% 0.15 250)' },
  { name: 'cyan', label: 'Cyan', value: 'oklch(64% 0.12 210)' },
  { name: 'green', label: 'Green', value: 'oklch(62% 0.15 150)' },
  { name: 'amber', label: 'Amber', value: 'oklch(72% 0.14 75)' },
  { name: 'rose', label: 'Rose', value: 'oklch(62% 0.18 20)' },
  { name: 'pink', label: 'Pink', value: 'oklch(64% 0.18 350)' },
];

const BY_NAME = new Map(ACCENT_OPTIONS.map((option) => [option.name, option]));

/** The colour behind a stored name, or null when it names nothing we offer. */
export function accentValue(name: string | null | undefined): string | null {
  if (!name) return null;
  return BY_NAME.get(name)?.value ?? null;
}
