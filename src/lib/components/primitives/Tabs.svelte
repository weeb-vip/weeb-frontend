<script lang="ts" module>
  import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
  import type { Snippet } from 'svelte';

  export interface TabItem {
    /** Stable key; what `onChange` hands back. */
    value: string;
    label: string;
    /** Drawn as the trailing pill the profile status tabs use. `0` still renders, muted. */
    count?: number | null;
    icon?: IconDefinition;
    /** Accessible name and tooltip. Required when `iconOnly`, since the label is hidden. */
    title?: string;
    disabled?: boolean;
    /**
     * A CSS colour this item stands for -- `var(--cat-release)`, say. Draws a
     * leading dot in that colour and tints the active state with it instead of
     * the accent, which is how the news category chips tell four categories
     * apart while still being one pill.
     */
    accent?: string;
  }

  /**
   * `underline` is the profile status tabs; `segmented` the boxed switches
   * (medium toggle, schedule/calendar, grid/list); `pill` the character
   * filters. Same behaviour and same ARIA underneath -- only the skin differs.
   */
  export type TabsVariant = 'underline' | 'segmented' | 'pill';

  /**
   * `tabs` when the buttons swap panels of content: role=tablist, arrow keys,
   * one tab stop for the whole set. `toggle` when they set a mode rather than
   * reveal a panel (grid vs list): role=group with aria-pressed, and every
   * button is its own tab stop, which is what a reader expects of a button
   * group that isn't navigation.
   */
  export type TabsMode = 'tabs' | 'toggle';

  /**
   * How `toggle` mode marks the active button.
   *
   * `pressed` (the default) is `aria-pressed`, right for a mode switch that
   * turns something on. `current` is `aria-current="page"`, right for a strip
   * that NAVIGATES -- the season strips send you to /season/<key>, so nothing
   * gets "pressed" and no panel is revealed. Either way the button keeps its
   * implicit button role, which `role="tab"` would have overridden.
   */
  export type TabsActiveMarker = 'pressed' | 'current';

  /**
   * `compact` is the dense default. `touch` raises every button to the 44px
   * touch target, for a strip that is a page's primary way through it.
   */
  export type TabsSize = 'compact' | 'touch';
</script>

<script lang="ts">
  import Fa from 'svelte-fa';

  /**
   * One single-select button strip. It replaces six hand-rolled clusters --
   * `.tab-btn`, `.view-btn`, `.view-toggle-btn`, `.view-tab`, `.medium-btn`,
   * `.filter-pill` -- which shared one job and one ARIA pattern between them
   * while each re-implementing the keyboard support (or, mostly, not).
   *
   * Presentational -- no bloc. The selected value is the caller's state.
   */
  let {
    items,
    value,
    onChange,
    variant = 'underline',
    mode = 'tabs',
    size = 'compact',
    activeMarker = 'pressed',
    iconOnly = false,
    ariaLabel,
    itemContent,
    class: className = '',
    itemClass = '',
  }: {
    items: TabItem[];
    /** The selected item's `value`. */
    value: string;
    onChange: (value: string) => void;
    variant?: TabsVariant;
    mode?: TabsMode;
    size?: TabsSize;
    /** `toggle` mode only: aria-pressed (a mode switch) or aria-current (navigation). */
    activeMarker?: TabsActiveMarker;
    /** Hides labels, leaving the icon. Each item then needs a `title`. */
    iconOnly?: boolean;
    /** Names the set for a screen reader, e.g. "Anime or manga". */
    ariaLabel?: string;
    /** Full control of a button's contents -- for the inline SVGs the pages use. */
    itemContent?: Snippet<[TabItem]>;
    class?: string;
    /** Extra class on every button, for a page's own styling and test hooks. */
    itemClass?: string;
  } = $props();

  let buttons = $state<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = $derived(items.findIndex((item) => item.value === value));

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
    buttons[index]?.focus();
    if (item.value !== value) onChange(item.value);
  }

  function handleKeydown(event: KeyboardEvent): void {
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
   * it; in toggle mode each button is reachable by Tab on its own.
   */
  function tabIndexFor(index: number): number | undefined {
    if (mode !== 'tabs') return undefined;
    if (selectedIndex < 0) return index === 0 ? 0 : -1;
    return index === selectedIndex ? 0 : -1;
  }
</script>

<!-- One body for both branches: only the ARIA differs between them, and the dot,
     label and count had already been written out twice. -->
{#snippet body(item: TabItem)}
  {#if item.accent}
    <span class="tab-dot" aria-hidden="true"></span>
  {/if}
  {#if itemContent}
    {@render itemContent(item)}
  {:else if item.icon}
    <span class="tab-icon" aria-hidden="true"><Fa icon={item.icon} /></span>
  {/if}
  {#if !iconOnly}
    <span class="tab-label">{item.label}</span>
    {#if item.count != null}
      <!-- An empty status recedes so the tabs with content are what the eye
           lands on; the numeral stays legible rather than fading out. -->
      <span class="tab-count" class:is-zero={item.count === 0}>{item.count}</span>
    {/if}
  {/if}
{/snippet}

{#if mode === 'tabs'}
  <div class="tabs tabs--{variant} tabs--{size} {className}" role="tablist" aria-label={ariaLabel}>
    {#each items as item, i (item.value)}
      <button
        bind:this={buttons[i]}
        type="button"
        class="tab {itemClass}"
        class:active={item.value === value}
        class:icon-only={iconOnly}
        class:accented={!!item.accent}
        style={item.accent ? `--tab-accent: ${item.accent}` : undefined}
        role="tab"
        aria-selected={item.value === value}
        aria-label={iconOnly ? (item.title ?? item.label) : undefined}
        title={item.title}
        tabindex={tabIndexFor(i)}
        disabled={item.disabled}
        onclick={() => onChange(item.value)}
        onkeydown={handleKeydown}
      >
        {@render body(item)}
      </button>
    {/each}
  </div>
{:else}
  <div class="tabs tabs--{variant} tabs--{size} {className}" role="group" aria-label={ariaLabel}>
    {#each items as item, i (item.value)}
      <button
        bind:this={buttons[i]}
        type="button"
        class="tab {itemClass}"
        class:active={item.value === value}
        class:icon-only={iconOnly}
        class:accented={!!item.accent}
        style={item.accent ? `--tab-accent: ${item.accent}` : undefined}
        aria-pressed={activeMarker === 'pressed' ? item.value === value : undefined}
        aria-current={activeMarker === 'current' && item.value === value ? 'page' : undefined}
        aria-label={iconOnly ? (item.title ?? item.label) : undefined}
        title={item.title}
        disabled={item.disabled}
        onclick={() => onChange(item.value)}
        onkeydown={handleKeydown}
      >
        {@render body(item)}
      </button>
    {/each}
  </div>
{/if}

<style>
  .tabs {
    display: flex;
    align-items: center;
  }

  .tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: none;
    border: none;
    font-family: inherit;
    color: var(--weeb-fg-muted);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .tab:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .tab:focus-visible {
    outline: 2px solid var(--weeb-accent);
    outline-offset: -2px;
  }
  .tab-icon { display: inline-flex; }

  /* An item's own colour, when it has one. The dot carries it at rest; the
     active skin below tints itself with it instead of the accent. */
  .tab-dot {
    width: 6px;
    height: 6px;
    flex: none;
    border-radius: var(--weeb-radius-full);
    background: var(--tab-accent, var(--weeb-fg-muted));
  }

  /* The 44px touch target, for a strip that is a page's primary way through it. */
  .tabs--touch .tab { min-height: var(--weeb-pill-min-height-touch); }

  /* ── underline ── the profile status tabs ─────────────────── */
  .tabs--underline {
    border-bottom: 1px solid var(--weeb-border);
    overflow-x: auto;
    scrollbar-width: none;
    min-width: 0;
  }
  .tabs--underline::-webkit-scrollbar { display: none; }

  .tabs--underline .tab {
    padding: 10px 16px;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    font-size: 0.85rem;
    font-weight: 500;
  }
  .tabs--underline .tab:hover:not(:disabled) { color: var(--weeb-fg); }
  .tabs--underline .tab.active {
    color: var(--weeb-accent-text);
    border-bottom-color: var(--weeb-accent);
  }

  /* The one count-badge treatment -- shared with FilterPills, which is why every
     number is driven off --weeb-pill-count-*. */
  .tab-count {
    font-size: var(--weeb-pill-count-font-size);
    line-height: 1;
    font-variant-numeric: tabular-nums;
    font-family: var(--weeb-font-mono, monospace);
    background: var(--weeb-surface-hover);
    color: var(--weeb-fg-secondary);
    padding: var(--weeb-pill-count-padding);
    border-radius: var(--weeb-pill-count-radius);
    font-weight: 600;
    min-width: var(--weeb-pill-count-min-width);
    text-align: center;
    transition: background 0.15s, color 0.15s;
  }
  .tab-count.is-zero {
    background: transparent;
    color: var(--weeb-fg-muted);
  }
  .tab.active .tab-count {
    background: color-mix(in oklch, var(--tab-accent, var(--weeb-accent)) 18%, transparent);
    color: var(--weeb-accent-text);
  }

  /* ── segmented ── the boxed mode switches ─────────────────── */
  .tabs--segmented {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    flex-shrink: 0;
  }
  .tabs--segmented .tab {
    height: 30px;
    padding: 0 var(--weeb-pill-padding-x);
    border-radius: calc(var(--weeb-radius) - 2px);
    font-size: 13px;
    font-weight: 500;
  }
  /* `height` beats `min-height`, so the touch size has to set it. */
  .tabs--segmented.tabs--touch .tab { height: var(--weeb-pill-min-height-touch); }
  .tabs--segmented .tab.icon-only {
    width: 34px;
    padding: 0;
  }
  .tabs--segmented .tab:hover:not(:disabled):not(.active) {
    color: var(--weeb-fg);
    background: var(--weeb-surface-hover);
  }
  .tabs--segmented .tab.active {
    background: var(--weeb-accent);
    color: #fff;
  }

  /* ── pill ── the character filters and the news category chips ──
     The shape here is THE pill shape: FilterPills and GenrePills read the same
     --weeb-pill-* tokens, so the three cannot drift apart again. */
  .tabs--pill {
    display: flex;
    flex-wrap: wrap;
    gap: var(--weeb-pill-row-gap);
  }
  .tabs--pill .tab {
    gap: var(--weeb-pill-gap);
    min-height: var(--weeb-pill-min-height);
    padding: var(--weeb-pill-padding-y) var(--weeb-pill-padding-x);
    border-radius: var(--weeb-pill-radius);
    border: 1px solid var(--weeb-border);
    color: var(--weeb-fg-secondary);
    font-size: var(--weeb-pill-font-size);
    font-weight: var(--weeb-pill-font-weight);
  }
  .tabs--pill .tab:hover:not(:disabled):not(.active) {
    border-color: var(--tab-accent, var(--weeb-accent));
    color: var(--weeb-fg);
    background: color-mix(in oklch, var(--tab-accent, var(--weeb-accent)) 8%, transparent);
  }
  .tabs--pill .tab.active {
    background: color-mix(in oklch, var(--weeb-accent) 18%, transparent);
    border-color: var(--weeb-accent);
    color: var(--weeb-accent-text);
  }
  /* An item with its own colour tints itself with that instead, and keeps the
     neutral foreground: the wash and the dot already say which one it is, and
     four different text colours in one row would not. */
  .tabs--pill .tab.accented.active {
    background: color-mix(in oklch, var(--tab-accent) 15%, transparent);
    border-color: color-mix(in oklch, var(--tab-accent) 65%, transparent);
    color: var(--weeb-fg);
  }
  .tabs--pill .tab:focus-visible { outline-offset: 2px; }
</style>
