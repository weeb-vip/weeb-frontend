
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
   * -- it is `Chip`, wrapped in a row gap -- and it is the ONE treatment for
   * picking out of a row, whether the row takes one answer or several.
   * `underline` is not a pill, so that skin is the only CSS in this file that
   * touches a chip.
   *
   * `segmented` -- a grey container round the row, a solid accent fill on the
   * selected chip -- was a second language for pill's job and has retired into
   * it. A multi-select row is several chips on at once, and a solid fill there
   * is a run of loud purple blocks; one tinted chip among outlines reads the
   * same at one selection or six. The container, meanwhile, only held together
   * while the items did not wrap, which is why /search's 16-genre row could
   * never be given one.
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
    nowrap = false,
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
    /**
     * Keeps the row on one line and scrolls it sideways instead of wrapping.
     * For a strip that IS the page's spine -- the season and year strips -- where
     * three wrapped lines of choices push the content itself off a phone screen.
     * The row scrolls inside itself, so the page never scrolls sideways.
     */
    nowrap?: boolean;
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
  class="chipgroup chipgroup--{variant} {isTouch ? 'chipgroup--touch' : ''} {nowrap
    ? 'chipgroup--nowrap'
    : ''} {className}"
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

  /* ── pill ── every row that picks: one of N, several of N, or none ──
     Deliberately empty of pill CSS. The shape, the ground, the hover, the
     selected wash, the dot and the count badge are all `Chip`; this variant
     owns the row gap and nothing else. */
  .chipgroup--pill {
    display: flex;
    flex-wrap: wrap;
    gap: var(--weeb-pill-row-gap);
  }

  /* An icon-only chip has no label to stretch it into a lozenge, so it is a
     circle rather than a wide oval: square, at whatever height its size gives
     it. The retired `segmented` skin squared these off at a fixed 34px; the
     ratio does the same job without pinning a second height into the app. */
  .chipgroup--pill :global(.chip.cg-item.cg-icon-only) {
    aspect-ratio: 1;
    padding: 0;
  }

  /* One line, scrolled, for the strips that are a page's spine. Declared here
     rather than three times over in the pages that need it -- and the row
     scrolls inside its own box, so documentElement never widens. */
  .chipgroup--nowrap {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    min-width: 0;
  }
  .chipgroup--nowrap::-webkit-scrollbar {
    display: none;
  }
  /* The ring is drawn inside, so the scroll box does not clip it. */
  .chipgroup--nowrap :global(.chip.cg-item:focus-visible) {
    outline-offset: -2px;
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

  /* The underline row scrolls, so it draws its focus ring inside rather than
     letting the overflow box clip it. */
  .chipgroup--underline :global(.chip.cg-item--underline:focus-visible) {
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
