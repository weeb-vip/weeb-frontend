/**
 * ChipGroup's vocabulary, and every decision the row makes: which ARIA shape it
 * is, which chip counts as selected, which markers that state gets, where the
 * roving arrow keys go next, and the affordance class list.
 *
 * The view keeps the DOM half -- focusing a button, delegating the keydown --
 * and reads the answers from here.
 */

import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { Snippet } from 'svelte';
import type { ChipSize } from '$lib/components/primitives/Chip';

export interface ChipGroupItem {
  /** Stable key; what `onSelect` hands back. Defaults to `label`. */
  value?: string;
  label: string;
  /** Rendered as `Chip`'s count badge. `0` still renders, muted. */
  count?: number | null;
  icon?: IconDefinition;
  /** Accessible name and tooltip. Required when `iconOnly`, since the label is hidden. */
  title?: string;
  disabled?: boolean;
  /**
   * A CSS colour this item stands for -- `var(--cat-release)`, say. Draws a
   * leading dot in that colour and tints the selected state with it instead
   * of the accent, which is how the news category chips tell four categories
   * apart while still being one chip. The chip stays neutral at rest.
   */
  accent?: string;
  /** `select="none"` only: makes the chip a link. */
  href?: string;
}

/**
 * The leading "Clear" chip. Pass it only while something is selected -- the
 * component does not infer that, because "how many are on" is the caller's
 * state, not this component's.
 */
export interface ChipGroupClear {
  label?: string;
  onClear: () => void;
}

/**
 * The trailing "+N more" chip, for a row that shows its busiest facets first.
 *
 * `collapseLabel` makes the reveal reversible ("Show less"). Omit it for a
 * one-way reveal -- once `expanded`, the chip simply goes away, which is what
 * /search does.
 */
export interface ChipGroupMore {
  hiddenCount: number;
  expanded: boolean;
  onToggle: () => void;
  collapseLabel?: string;
}

/**
 * How many of the row can be on at once.
 *
 * `single` is one item at a time (the status tabs, the mode switches, the
 * season strips). `multi` is any number at once (the genre and tag facets).
 * `none` is a row that selects nothing -- the homepage's genre links.
 */
export type ChipGroupSelect = 'single' | 'multi' | 'none';

/**
 * The skin. `pill` is `Chip` exactly as `Chip` draws it; `segmented` the
 * boxed switches (medium toggle, schedule/calendar, grid/list, the season and
 * year strips); `underline` the profile status tabs and the show section nav.
 * Same items, same ARIA, same behaviour underneath -- only the skin differs.
 */
export type ChipGroupVariant = 'pill' | 'segmented' | 'underline';

/**
 * `tabs` when the chips swap panels of content: role=tablist, arrow keys, one
 * tab stop for the whole set. `toggle` when they set a mode rather than
 * reveal a panel (grid vs list): role=group with aria-pressed, and every chip
 * is its own tab stop, which is what a reader expects of a button group that
 * isn't navigation. `single` only -- a `multi` row is always a group of
 * independent toggles, and a `none` row is not a control at all.
 */
export type ChipGroupMode = 'tabs' | 'toggle';

/**
 * How `toggle` mode marks the active chip.
 *
 * `pressed` (the default) is `aria-pressed`, right for a mode switch that
 * turns something on. `current` is `aria-current="page"`, right for a strip
 * that NAVIGATES -- the season strips send you to /season/<key>, so nothing
 * gets "pressed" and no panel is revealed. Either way the chip keeps its
 * implicit button role, which `role="tab"` would have overridden.
 */
export type ChipGroupActiveMarker = 'pressed' | 'current';

/**
 * `sm` is `Chip`'s dense 11px metadata size, `md` the 12px default, and
 * `touch` raises every chip to the 44px target -- for a strip that is a
 * page's primary way through it.
 */
export type ChipGroupSize = 'sm' | 'md' | 'touch';

/** Stable key for an item; `value` when it has one, else the label. */
export function keyOf(item: ChipGroupItem): string {
  return item.value ?? item.label;
}

/** A single-select row of tabs is a real tablist; nothing else is. */
export function isTablist(select: ChipGroupSelect, mode: ChipGroupMode): boolean {
  return select === 'single' && mode === 'tabs';
}

/** A row that selects nothing and names nothing is not a landmark at all. */
export function containerRole(
  select: ChipGroupSelect,
  mode: ChipGroupMode,
  ariaLabel: string | undefined
): 'tablist' | 'group' | undefined {
  if (isTablist(select, mode)) return 'tablist';
  return select === 'none' && !ariaLabel ? undefined : 'group';
}

/** `touch` is a height, not a type scale: the chips inside stay at the default size. */
export function chipSizeFor(size: ChipGroupSize): ChipSize {
  return size === 'sm' ? 'sm' : 'md';
}

export function isTouch(size: ChipGroupSize): boolean {
  return size === 'touch';
}

export function selectedOf(
  key: string,
  select: ChipGroupSelect,
  value: string | undefined,
  isSelected: ((value: string) => boolean) | undefined
): boolean {
  if (isSelected) return isSelected(key);
  return select === 'single' && key === value;
}

export function pressedFor(
  on: boolean,
  select: ChipGroupSelect,
  mode: ChipGroupMode,
  activeMarker: ChipGroupActiveMarker
): boolean | undefined {
  if (select === 'multi') return on;
  if (select === 'single' && mode === 'toggle' && activeMarker === 'pressed') return on;
  return undefined;
}

export function currentFor(
  on: boolean,
  select: ChipGroupSelect,
  mode: ChipGroupMode,
  activeMarker: ChipGroupActiveMarker
): 'page' | undefined {
  return select === 'single' && mode === 'toggle' && activeMarker === 'current' && on
    ? 'page'
    : undefined;
}

/** The "+N more" chip is drawn only while it has something left to say. */
export function showMore(more: ChipGroupMore | undefined): boolean {
  return more != null && (more.expanded ? more.collapseLabel != null : more.hiddenCount > 0);
}

export function selectedIndexOf(items: ChipGroupItem[], value: string | undefined): number {
  return items.findIndex((item) => keyOf(item) === value);
}

/** Skips disabled items, and wraps -- the ARIA tabs pattern's default. */
export function nextEnabled(items: ChipGroupItem[], from: number, step: number): number {
  const n = items.length;
  if (n === 0) return -1;
  let i = from;
  for (let hops = 0; hops < n; hops++) {
    i = (i + step + n) % n;
    if (!items[i].disabled) return i;
  }
  return from;
}

/**
 * Which item a roving arrow key lands on, or `null` when the key is not one the
 * row answers to.
 */
export function keyTarget(
  key: string,
  items: ChipGroupItem[],
  selectedIndex: number
): number | null {
  const from = selectedIndex >= 0 ? selectedIndex : 0;
  if (key === 'ArrowRight' || key === 'ArrowDown') return nextEnabled(items, from, 1);
  if (key === 'ArrowLeft' || key === 'ArrowUp') return nextEnabled(items, from, -1);
  if (key === 'Home') return nextEnabled(items, -1, 1);
  if (key === 'End') return nextEnabled(items, items.length, -1);
  return null;
}

/**
 * In tabs mode the whole strip is one tab stop and the arrows move within
 * it; otherwise each chip is reachable by Tab on its own.
 */
export function tabIndexFor(
  index: number,
  tablist: boolean,
  selectedIndex: number
): number | undefined {
  if (!tablist) return undefined;
  if (selectedIndex < 0) return index === 0 ? 0 : -1;
  return index === selectedIndex ? 0 : -1;
}

export function affordanceClass(kind: 'clear' | 'more', itemClass: string): string {
  return ['cg-affordance', `cg-${kind}`, itemClass, itemClass ? `${itemClass}--${kind}` : '']
    .filter(Boolean)
    .join(' ');
}
