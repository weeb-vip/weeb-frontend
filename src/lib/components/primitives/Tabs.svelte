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
    iconOnly = false,
    ariaLabel,
    itemContent,
    class: className = '',
  }: {
    items: TabItem[];
    /** The selected item's `value`. */
    value: string;
    onChange: (value: string) => void;
    variant?: TabsVariant;
    mode?: TabsMode;
    /** Hides labels, leaving the icon. Each item then needs a `title`. */
    iconOnly?: boolean;
    /** Names the set for a screen reader, e.g. "Anime or manga". */
    ariaLabel?: string;
    /** Full control of a button's contents -- for the inline SVGs the pages use. */
    itemContent?: Snippet<[TabItem]>;
    class?: string;
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

{#if mode === 'tabs'}
  <div class="tabs tabs--{variant} {className}" role="tablist" aria-label={ariaLabel}>
    {#each items as item, i (item.value)}
      <button
        bind:this={buttons[i]}
        type="button"
        class="tab"
        class:active={item.value === value}
        class:icon-only={iconOnly}
        role="tab"
        aria-selected={item.value === value}
        aria-label={iconOnly ? (item.title ?? item.label) : undefined}
        title={item.title}
        tabindex={tabIndexFor(i)}
        disabled={item.disabled}
        onclick={() => onChange(item.value)}
        onkeydown={handleKeydown}
      >
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
      </button>
    {/each}
  </div>
{:else}
  <div class="tabs tabs--{variant} {className}" role="group" aria-label={ariaLabel}>
    {#each items as item, i (item.value)}
      <button
        bind:this={buttons[i]}
        type="button"
        class="tab"
        class:active={item.value === value}
        class:icon-only={iconOnly}
        aria-pressed={item.value === value}
        aria-label={iconOnly ? (item.title ?? item.label) : undefined}
        title={item.title}
        disabled={item.disabled}
        onclick={() => onChange(item.value)}
        onkeydown={handleKeydown}
      >
        {#if itemContent}
          {@render itemContent(item)}
        {:else if item.icon}
          <span class="tab-icon" aria-hidden="true"><Fa icon={item.icon} /></span>
        {/if}
        {#if !iconOnly}
          <span class="tab-label">{item.label}</span>
          {#if item.count != null}
            <span class="tab-count" class:is-zero={item.count === 0}>{item.count}</span>
          {/if}
        {/if}
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

  .tab-count {
    font-size: 0.68rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    font-family: var(--weeb-font-mono, monospace);
    background: var(--weeb-surface-hover);
    color: var(--weeb-fg-secondary);
    padding: 2px 6px;
    border-radius: 6px;
    font-weight: 600;
    min-width: 18px;
    text-align: center;
    transition: background 0.15s, color 0.15s;
  }
  .tab-count.is-zero {
    background: transparent;
    color: var(--weeb-fg-muted);
  }
  .tab.active .tab-count {
    background: color-mix(in oklch, var(--weeb-accent) 18%, transparent);
    color: var(--weeb-accent-text);
  }

  /* ── segmented ── the boxed mode switches ─────────────────── */
  .tabs--segmented {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    flex-shrink: 0;
  }
  .tabs--segmented .tab {
    height: 30px;
    padding: 0 14px;
    border-radius: calc(var(--weeb-radius, 8px) - 2px);
    font-size: 13px;
    font-weight: 500;
  }
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

  /* ── pill ── the character filters ────────────────────────── */
  .tabs--pill {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .tabs--pill .tab {
    padding: 6px 14px;
    border-radius: var(--weeb-radius-full, 9999px);
    border: 1px solid var(--weeb-border);
    color: var(--weeb-fg-secondary);
    font-size: 12px;
    font-weight: 600;
  }
  .tabs--pill .tab:hover:not(:disabled):not(.active) {
    border-color: var(--weeb-accent);
    color: var(--weeb-fg);
  }
  .tabs--pill .tab.active {
    background: color-mix(in oklch, var(--weeb-accent) 18%, transparent);
    border-color: var(--weeb-accent);
    color: var(--weeb-accent-text);
  }
  .tabs--pill .tab:focus-visible { outline-offset: 2px; }
</style>
