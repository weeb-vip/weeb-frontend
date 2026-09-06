
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Fa from 'svelte-fa';
  import Chip, { type ChipTone } from '$lib/components/primitives/Chip';
  import {
    affordanceClass,
    chipSizeFor,
    containerRole as roleFor,
    currentFor as currentMarkerFor,
    isTablist as tablistFor,
    isTouch as touchFor,
    keyOf,
    keyTarget,
    pressedFor as pressedMarkerFor,
    selectedIndexOf,
    selectedOf as selectedForKey,
    showMore as showMoreFor,
    tabIndexFor as tabIndexAt,
    type ChipGroupActiveMarker,
    type ChipGroupClear,
    type ChipGroupItem,
    type ChipGroupMode,
    type ChipGroupMore,
    type ChipGroupSelect,
    type ChipGroupSize,
    type ChipGroupVariant
  } from './ChipGroup.logic';

  /**
   * THE row of chips. One component for every selectable or linked strip in the
   * app, in both skins.
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
   * -- it is `Chip`, wrapped in a row gap -- and it is the ONE ground every
   * free-flowing row sits on: transparent inside an outline, whether the row
   * selects one of its chips, several, or none at all. `segmented` is not a
   * pill, so that skin is the only CSS in this file that touches a chip.
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

  const isTablist = $derived(tablistFor(select, mode));
  const containerRole = $derived(roleFor(select, mode, ariaLabel));
  const chipSize = $derived(chipSizeFor(size));
  const isTouch = $derived(touchFor(size));
  const showMore = $derived(showMoreFor(more));
  const selectedIndex = $derived(selectedIndexOf(items, value));

  const selectedOf = (key: string) => selectedForKey(key, select, value, isSelected);
  const pressedFor = (on: boolean) => pressedMarkerFor(on, select, mode, activeMarker);
  const currentFor = (on: boolean) => currentMarkerFor(on, select, mode, activeMarker);
  const tabIndexFor = (index: number) => tabIndexAt(index, isTablist, selectedIndex);

  /* ── Keyboard ──
     Roving arrows belong to a single-select row: they move focus AND change the
     selection, which is right for a tablist or a mode switch and wrong for a
     multi-select row, where an arrow key would silently toggle a filter on.
     Where they land is `keyTarget`'s call; this half only moves the focus. */
  let root = $state<HTMLDivElement | null>(null);

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

    const target = keyTarget(event.key, items, selectedIndex);
    if (target === null) return;
    event.preventDefault();
    focusAndSelect(target);
  }
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
      class={affordanceClass('clear', itemClass)}
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
      ghost
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
      class={affordanceClass('more', itemClass)}
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

  /* ── pill ── every free-flowing row: filters, facets, links, static labels ──
     Deliberately empty of pill CSS. The shape, the ground, the hover, the
     selected wash, the dot and the count badge are all `Chip`; this variant
     owns the row gap and nothing else. One ground for the lot of them: the
     chips are `ghost` whatever the row selects, so nothing in the row is
     filled until it is on. */
  .chipgroup--pill {
    display: flex;
    flex-wrap: wrap;
    gap: var(--weeb-pill-row-gap);
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

  /* The boxed skin draws its focus ring inside, so the box does not clip it. */
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
