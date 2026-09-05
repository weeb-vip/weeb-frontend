<script lang="ts" module>
  export interface FilterPillItem {
    /** Stable key; what `onToggle` hands back. */
    value: string;
    label: string;
    /** Rendered as the shared count badge. `0` still renders, muted. */
    count?: number | null;
  }

  /**
   * The leading "Clear" pill. Pass it only while something is selected -- the
   * component does not infer that, because "how many are on" is the caller's
   * state, not this component's.
   */
  export interface FilterPillsClear {
    label?: string;
    onClear: () => void;
  }

  /**
   * The trailing "+N more" pill, for a row that shows its busiest facets first.
   *
   * `collapseLabel` makes the reveal reversible ("Show less"). Omit it for a
   * one-way reveal -- once `expanded`, the pill simply goes away, which is what
   * /search does.
   */
  export interface FilterPillsMore {
    hiddenCount: number;
    expanded: boolean;
    onToggle: () => void;
    collapseLabel?: string;
  }
</script>

<script lang="ts">
  /**
   * One MULTI-select filter row: pills that each turn on or off independently,
   * with optional counts, an optional "Clear" pill and an optional "+N more".
   *
   * The sibling of `Tabs`, not a variant of it. Tabs is single-select -- one
   * `value`, `aria-selected`/`aria-pressed` on exactly one button. These are
   * checkboxes wearing a pill: any number can be on at once, so each carries its
   * own `aria-pressed`. They shared a look and nothing else, which is how the
   * same row ended up hand-rolled on /season and /search with different radii,
   * different counts and different selected states.
   *
   * The shape comes from the --weeb-pill-* tokens, so this, `Tabs`' pill variant
   * and `GenrePills` are one pill and cannot drift apart again.
   *
   * Presentational -- no bloc. Which pills are on is the caller's state.
   */
  let {
    items,
    isSelected,
    onToggle,
    clear = undefined,
    more = undefined,
    ariaLabel,
    class: className = '',
    pillClass = '',
  }: {
    items: FilterPillItem[];
    /**
     * Whether one pill is on. A predicate rather than an array of values, so a
     * caller keeping a `Set` (both of ours do) needs no extra accessor.
     */
    isSelected: (value: string) => boolean;
    onToggle: (value: string) => void;
    clear?: FilterPillsClear;
    more?: FilterPillsMore;
    /** Names the row for a screen reader, e.g. "Filter by genre". */
    ariaLabel?: string;
    class?: string;
    /**
     * Base class on every pill; the clear and more pills additionally get
     * `<pillClass>--clear` and `<pillClass>--more`. Here so a page can keep the
     * selector hooks its tests already reach for.
     */
    pillClass?: string;
  } = $props();

  const showMore = $derived(
    more != null && (more.expanded ? more.collapseLabel != null : more.hiddenCount > 0)
  );
</script>

<div class="filter-pills {className}" role="group" aria-label={ariaLabel}>
  {#if clear}
    <button
      type="button"
      class="pill pill--clear {pillClass} {pillClass ? `${pillClass}--clear` : ''}"
      onclick={() => clear.onClear()}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
      {clear.label ?? 'Clear'}
    </button>
  {/if}

  {#each items as item (item.value)}
    <button
      type="button"
      class="pill {pillClass}"
      class:selected={isSelected(item.value)}
      aria-pressed={isSelected(item.value)}
      onclick={() => onToggle(item.value)}
    >
      <span class="pill-label">{item.label}</span>
      {#if item.count != null}
        <span class="pill-count" class:is-zero={item.count === 0}>{item.count.toLocaleString()}</span>
      {/if}
    </button>
  {/each}

  {#if showMore && more}
    <button
      type="button"
      class="pill pill--more {pillClass} {pillClass ? `${pillClass}--more` : ''}"
      onclick={() => more.onToggle()}
    >
      {more.expanded ? more.collapseLabel : `+${more.hiddenCount} more`}
    </button>
  {/if}
</div>

<style>
  .filter-pills {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--weeb-pill-row-gap);
  }

  /* THE pill shape. Identical to Tabs' `pill` variant and GenrePills, because
     all three read the same tokens. */
  .pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--weeb-pill-gap);
    min-height: var(--weeb-pill-min-height);
    padding: var(--weeb-pill-padding-y) var(--weeb-pill-padding-x);
    border-radius: var(--weeb-pill-radius);
    border: 1px solid var(--weeb-border);
    background: transparent;
    color: var(--weeb-fg-secondary);
    font-family: inherit;
    font-size: var(--weeb-pill-font-size);
    font-weight: var(--weeb-pill-font-weight);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .pill:hover:not(.selected) {
    border-color: var(--weeb-accent);
    color: var(--weeb-fg);
    background: color-mix(in oklch, var(--weeb-accent) 8%, transparent);
  }
  .pill:focus-visible {
    outline: 2px solid var(--weeb-accent);
    outline-offset: 2px;
  }

  /* The selected state is the one Tabs' pill uses for its active item: a wash
     rather than a solid fill, so "this filter is on" reads the same whether the
     row picks one or many. */
  .pill.selected {
    background: color-mix(in oklch, var(--weeb-accent) 18%, transparent);
    border-color: var(--weeb-accent);
    color: var(--weeb-accent-text);
  }

  /* The one count-badge treatment, shared with Tabs. */
  .pill-count {
    font-family: var(--weeb-font-mono, monospace);
    font-size: var(--weeb-pill-count-font-size);
    line-height: 1;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    min-width: var(--weeb-pill-count-min-width);
    text-align: center;
    padding: var(--weeb-pill-count-padding);
    border-radius: var(--weeb-pill-count-radius);
    background: var(--weeb-surface-hover);
    color: var(--weeb-fg-secondary);
    transition: background 0.15s, color 0.15s;
  }
  .pill-count.is-zero {
    background: transparent;
    color: var(--weeb-fg-muted);
  }
  .pill.selected .pill-count {
    background: color-mix(in oklch, var(--weeb-accent) 18%, transparent);
    color: var(--weeb-accent-text);
  }

  /* Clearing is destructive, so it is the one pill that is not accent-coloured. */
  .pill--clear {
    border-color: var(--weeb-red);
    color: var(--weeb-red);
    gap: 4px;
  }
  .pill--clear:hover:not(.selected) {
    background: var(--weeb-red);
    border-color: var(--weeb-red);
    color: white;
  }

  /* Dashed: this pill reveals more of the row rather than filtering by anything. */
  .pill--more {
    border-style: dashed;
    color: var(--weeb-fg-muted);
  }
  .pill--more:hover:not(.selected) {
    border-style: solid;
    border-color: var(--weeb-accent);
    color: var(--weeb-accent-text);
  }

  @media (prefers-reduced-motion: reduce) {
    .pill, .pill-count { transition: none; }
  }
</style>
