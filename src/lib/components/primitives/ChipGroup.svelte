<script lang="ts" module>
  import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
  import type { Snippet } from 'svelte';

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
</script>

<script lang="ts">
  import Fa from 'svelte-fa';
  import Chip, { type ChipTone } from './Chip.svelte';

  /**
   * THE row of chips. One component for every selectable or linked strip in the
   * app, in all three skins.
   *
   * It exists because the row had been written three times over -- `Tabs`
   * (single-select, three variants), `FilterPills` (multi-select, counts, clear
   * and "+N more") and `ChipRow` (links) -- each re-declaring the pill off the
   * same `--weeb-pill-*` tokens that `Chip` already owns. Three agreeing copies
   * of a rule are still three copies, and they had already drifted: the same
   * facet row was hand-rolled on /season and /search with different radii,
   * counts and selected states before any of them existed.
   *
   * So the item here is always `Chip`. The `pill` variant adds no shape at all
   * -- it is `Chip`, wrapped in a row gap. `segmented` and `underline` are not
   * pills, so those two skins are the only CSS in this file that touches a chip.
   *
   * Presentational -- no bloc. What is selected is the caller's state.
   */
  let {
    items = [],
    select = 'single',
    variant = 'pill',
    value = undefined,
    isSelected = undefined,
    onSelect = undefined,
    mode = 'tabs',
    activeMarker = 'pressed',
    size = 'md',
    tone = 'neutral',
    iconOnly = false,
    clear = undefined,
    more = undefined,
    ariaLabel = undefined,
    itemContent,
    children,
    class: className = '',
    itemClass = '',
  }: {
    items?: ChipGroupItem[];
    select?: ChipGroupSelect;
    variant?: ChipGroupVariant;
    /** `select="single"`: the selected item's `value`. */
    value?: string;
    /**
     * `select="multi"`: whether one chip is on. A predicate rather than an
     * array, so a caller keeping a `Set` (both of ours do) needs no accessor.
     */
    isSelected?: (value: string) => boolean;
    /** A chip was activated: the new value for `single`, the toggled one for `multi`. */
    onSelect?: (value: string) => void;
    /** `select="single"` only: aria-pressed/aria-current (toggle) or a real tablist. */
    mode?: ChipGroupMode;
    activeMarker?: ChipGroupActiveMarker;
    size?: ChipGroupSize;
    /** Applied to every chip, for a row that states rather than selects. */
    tone?: ChipTone;
    /** Hides labels, leaving the icon. Each item then needs a `title`. */
    iconOnly?: boolean;
    clear?: ChipGroupClear;
    more?: ChipGroupMore;
    /** Names the row for a screen reader, e.g. "Filter by genre". */
    ariaLabel?: string;
    /** Full control of a chip's contents -- for the inline SVGs the pages use. */
    itemContent?: Snippet<[ChipGroupItem]>;
    /** Chips the caller builds itself, rendered after `items`. */
    children?: Snippet;
    class?: string;
    /**
     * Base class on every chip; the clear and more chips additionally get
     * `<itemClass>--clear` and `<itemClass>--more`. Here so a page can keep the
     * selector hooks its tests already reach for.
     */
    itemClass?: string;
  } = $props();

  const keyOf = (item: ChipGroupItem): string => item.value ?? item.label;

  const isTablist = $derived(select === 'single' && mode === 'tabs');
  const containerRole = $derived(
    isTablist ? 'tablist' : select === 'none' && !ariaLabel ? undefined : 'group'
  );

  const chipSize = $derived(size === 'sm' ? 'sm' : 'md');
  const isTouch = $derived(size === 'touch');

  function selectedOf(key: string): boolean {
    if (isSelected) return isSelected(key);
    return select === 'single' && key === value;
  }

  function pressedFor(on: boolean): boolean | undefined {
    if (select === 'multi') return on;
    if (select === 'single' && mode === 'toggle' && activeMarker === 'pressed') return on;
    return undefined;
  }

  function currentFor(on: boolean): 'page' | undefined {
    return select === 'single' && mode === 'toggle' && activeMarker === 'current' && on
      ? 'page'
      : undefined;
  }

  const showMore = $derived(
    more != null && (more.expanded ? more.collapseLabel != null : more.hiddenCount > 0)
  );

  /* ── Keyboard ──
     Roving arrows belong to a single-select row: they move focus AND change the
     selection, which is right for a tablist or a mode switch and wrong for a
     multi-select row, where an arrow key would silently toggle a filter on. */
  let root = $state<HTMLDivElement | null>(null);

  const selectedIndex = $derived(items.findIndex((item) => keyOf(item) === value));

  /** Skips disabled items, and wraps -- the ARIA tabs pattern's default. */
  function nextEnabled(from: number, step: number): number {
    const n = items.length;
    if (n === 0) return -1;
    let i = from;
    for (let hops = 0; hops < n; hops++) {
      i = (i + step + n) % n;
      if (!items[i].disabled) return i;
    }
    return from;
  }

  function focusAndSelect(index: number): void {
    const item = items[index];
    if (!item || item.disabled) return;
    const buttons = root?.querySelectorAll<HTMLElement>('.cg-item');
    buttons?.[index]?.focus();
    const key = keyOf(item);
    if (key !== value) onSelect?.(key);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (select !== 'single') return;
    // Delegated, so the clear and more chips do not drive the roving selection.
    if (!(event.target as HTMLElement | null)?.classList?.contains('cg-item')) return;

    const from = selectedIndex >= 0 ? selectedIndex : 0;
    let target: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = nextEnabled(from, 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = nextEnabled(from, -1);
    else if (event.key === 'Home') target = nextEnabled(-1, 1);
    else if (event.key === 'End') target = nextEnabled(items.length, -1);

    if (target === null) return;
    event.preventDefault();
    focusAndSelect(target);
  }

  /**
   * In tabs mode the whole strip is one tab stop and the arrows move within
   * it; otherwise each chip is reachable by Tab on its own.
   */
  function tabIndexFor(index: number): number | undefined {
    if (!isTablist) return undefined;
    if (selectedIndex < 0) return index === 0 ? 0 : -1;
    return index === selectedIndex ? 0 : -1;
  }

  const affordanceClass = (kind: 'clear' | 'more'): string =>
    ['cg-affordance', `cg-${kind}`, itemClass, itemClass ? `${itemClass}--${kind}` : '']
      .filter(Boolean)
      .join(' ');
</script>

{#snippet clearIcon()}
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={root}
  class="chipgroup chipgroup--{variant} {isTouch ? 'chipgroup--touch' : ''} {className}"
  role={containerRole}
  aria-label={ariaLabel}
  onkeydown={select === 'single' ? handleKeydown : undefined}
>
  {#if clear}
    <Chip
      class={affordanceClass('clear')}
      ghost
      size={chipSize}
      touch={isTouch}
      label={clear.label ?? 'Clear'}
      leading={clearIcon}
      onclick={() => clear.onClear()}
    />
  {/if}

  {#each items as item, i (keyOf(item))}
    {@const key = keyOf(item)}
    {@const on = selectedOf(key)}
    <Chip
      class={['cg-item', `cg-item--${variant}`, iconOnly ? 'cg-icon-only' : '', itemClass]
        .filter(Boolean)
        .join(' ')}
      href={select === 'none' ? item.href : undefined}
      onclick={select === 'none' ? undefined : () => onSelect?.(key)}
      size={chipSize}
      touch={isTouch}
      {tone}
      color={item.accent}
      tintAtRest={select === 'none'}
      ghost={select !== 'none'}
      dot={!!item.accent}
      selected={on}
      count={iconOnly ? null : item.count}
      disabled={item.disabled}
      title={item.title}
      ariaLabel={iconOnly ? (item.title ?? item.label) : undefined}
      role={isTablist ? 'tab' : undefined}
      ariaSelected={isTablist ? on : undefined}
      tabindex={tabIndexFor(i)}
      ariaPressed={pressedFor(on)}
      ariaCurrent={currentFor(on)}
    >
      {#if itemContent}
        {@render itemContent(item)}
      {:else if item.icon}
        <span class="cg-icon" aria-hidden="true"><Fa icon={item.icon} /></span>
      {/if}
      {#if !iconOnly}
        <span class="cg-label">{item.label}</span>
      {/if}
    </Chip>
  {/each}

  {#if showMore && more}
    <Chip
      class={affordanceClass('more')}
      ghost
      size={chipSize}
      touch={isTouch}
      label={more.expanded ? (more.collapseLabel ?? '') : `+${more.hiddenCount} more`}
      onclick={() => more.onToggle()}
    />
  {/if}

  {@render children?.()}
</div>

<style>
  .chipgroup {
    display: flex;
    align-items: center;
  }
  .cg-icon {
    display: inline-flex;
  }

  /* ── pill ──────────────────────────────────────────────────
     Deliberately empty of pill CSS. The shape, the ground, the hover, the
     selected wash, the dot and the count badge are all `Chip`; this variant
     owns the row gap and nothing else. */
  .chipgroup--pill {
    display: flex;
    flex-wrap: wrap;
    gap: var(--weeb-pill-row-gap);
  }

  /* ── underline ── the profile status tabs, the show section nav ──
     Not a pill, so this skin overrides the chip outright: no border, no
     radius, no ground, and a rule under the active one instead of a wash. */
  .chipgroup--underline {
    border-bottom: 1px solid var(--weeb-border);
    overflow-x: auto;
    scrollbar-width: none;
    min-width: 0;
  }
  .chipgroup--underline::-webkit-scrollbar {
    display: none;
  }
  .chipgroup--underline :global(.chip.cg-item--underline) {
    min-height: 0;
    gap: 6px;
    padding: 10px 16px;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    margin-bottom: -1px;
    background: none;
    color: var(--weeb-fg-muted);
    font-size: 0.85rem;
    font-weight: 500;
    line-height: 1.5;
  }
  .chipgroup--underline.chipgroup--touch :global(.chip.cg-item--underline) {
    min-height: var(--weeb-pill-min-height-touch);
  }
  .chipgroup--underline :global(button.chip.cg-item--underline:hover:not(:disabled)) {
    background: none;
    border-bottom-color: transparent;
    color: var(--weeb-fg);
  }
  .chipgroup--underline :global(.chip.cg-item--underline.selected),
  .chipgroup--underline :global(button.chip.cg-item--underline.selected:hover) {
    color: var(--weeb-accent-text);
    background: none;
    border-bottom-color: var(--weeb-accent);
  }

  /* ── segmented ── the boxed mode switches and the season / year strips ──
     The box is the container; the chips inside it lose their own border and
     ground and take a solid fill when active. */
  .chipgroup--segmented {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    flex-shrink: 0;
  }
  .chipgroup--segmented :global(.chip.cg-item--segmented) {
    min-height: 0;
    height: 30px;
    gap: 6px;
    padding: 0 var(--weeb-pill-padding-x);
    border: none;
    border-radius: calc(var(--weeb-radius) - 2px);
    background: none;
    color: var(--weeb-fg-muted);
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
  }
  /* `height` beats `min-height`, so the touch size has to set it. */
  .chipgroup--segmented.chipgroup--touch :global(.chip.cg-item--segmented) {
    height: var(--weeb-pill-min-height-touch);
  }
  .chipgroup--segmented :global(.chip.cg-item--segmented.cg-icon-only) {
    width: 34px;
    padding: 0;
  }
  .chipgroup--segmented :global(button.chip.cg-item--segmented:hover:not(.selected):not(:disabled)) {
    color: var(--weeb-fg);
    background: var(--weeb-surface-hover);
  }
  .chipgroup--segmented :global(.chip.cg-item--segmented.selected),
  .chipgroup--segmented :global(button.chip.cg-item--segmented.selected:hover) {
    background: var(--weeb-accent);
    color: #fff;
  }

  /* Both boxed skins draw the focus ring inside, so it is not clipped by the
     box or the row's own overflow. */
  .chipgroup--underline :global(.chip.cg-item--underline:focus-visible),
  .chipgroup--segmented :global(.chip.cg-item--segmented:focus-visible) {
    outline-offset: -2px;
  }

  .chipgroup :global(.chip.cg-item:disabled) {
    opacity: 0.4;
  }

  /* ── The two affordances ──
     Clearing is destructive, so it is the one chip that is not accent-coloured.
     "+N more" is dashed: it reveals more of the row rather than filtering by
     anything. Neither is a facet, so neither is a `tone`. */
  .chipgroup :global(.chip.cg-clear) {
    gap: 4px;
    border-color: var(--weeb-red);
    color: var(--weeb-red);
  }
  .chipgroup :global(button.chip.cg-clear:hover:not(:disabled)) {
    background: var(--weeb-red);
    border-color: var(--weeb-red);
    color: white;
  }
  .chipgroup :global(.chip.cg-more) {
    border-style: dashed;
    color: var(--weeb-fg-muted);
  }
  .chipgroup :global(button.chip.cg-more:hover:not(:disabled)) {
    border-style: solid;
    border-color: var(--weeb-accent);
    color: var(--weeb-accent-text);
    background: color-mix(in oklch, var(--weeb-accent) 8%, transparent);
  }
</style>
