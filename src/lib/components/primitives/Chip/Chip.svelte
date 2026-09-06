
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { chipClass, chipStyle, type ChipSize, type ChipTone } from './Chip.logic';

  /**
   * THE pill. Every small labelled thing in the app is this component: the
   * homepage's genre links, the show page's quick-info facts, a media row's
   * type badge, a news category, a related-anime type.
   *
   * It exists because the same shape was written seven times over -- `Tag`
   * (rounded-md, 16px), `GenrePills.genre-pill`, `PosterCard.hover-genre`,
   * `ShowQuickInfo.qi-chip` with three variants of its own,
   * `RelatedAnime.rel-type`, `ProfileMediaList.row-type-badge` (radius 3px)
   * and `AnimeNews.badge` (radius 20px, "matching the site's hardcoded pill
   * radius" -- which was itself the drift the tokens exist to stop).
   *
   * So this file is the ONLY place the --weeb-pill-* tokens are read. Anything
   * pill-shaped composes it rather than re-declaring the shape off the same
   * tokens: five agreeing copies of a rule are still five copies.
   *
   * It renders as whatever it is: an <a> given an `href`, a <button> given an
   * `onclick`, a <span> otherwise. That one decision is what lets the link row
   * and the static badge be the same component.
   *
   * Presentational -- no bloc. Selection, counts and colours are the caller's.
   */
  let {
    label = '',
    href = undefined,
    onclick = undefined,
    tone = 'neutral',
    size = 'md',
    /**
     * An explicit colour for the tint, for an OPEN set the tones cannot name --
     * AnimeNews' categories, which the research model can extend at any time.
     * Pass a token reference, never a raw oklch().
     */
    color = undefined,
    /** Raises the pill to the touch height, for a row that is a primary way through a page. */
    touch = false,
    /** The selected/active state: the accent wash. */
    selected = false,
    /**
     * Where the chip's own colour shows. `true` tints border, text and ground
     * at rest -- a chip that STATES something ("airing", "TV"). `false` leaves
     * the chip neutral until it is selected, colouring only the dot and the
     * selected wash -- a filter row whose items each stand for a colour.
     */
    tintAtRest = true,
    /**
     * Transparent ground rather than the surface, with the hover tinted from
     * the chip's own colour instead of lifting to `--weeb-surface-hover`. What
     * a row of chips you can switch on and off sits on: nothing until it is on.
     */
    ghost = false,
    /** A leading dot in the chip's own colour. */
    dot = false,
    /** Rendered as the shared count badge. `0` still renders, muted. */
    count = null,
    /** Numerals in the mono face, for a chip whose label is a measured value. */
    mono = false,
    disabled = false,
    title = undefined,
    ariaLabel = undefined,
    ariaPressed = undefined,
    ariaCurrent = undefined,
    ariaSelected = undefined,
    /** ARIA role override -- `tab`, for a chip inside a real tablist. */
    role = undefined,
    /** Roving tabindex, for a chip inside a real tablist. */
    tabindex = undefined,
    /** Leading content -- an icon. Sized by the caller; 12px is the house size. */
    leading,
    /** The label, when it is richer than a string. Wins over `label`. */
    children,
    class: className = '',
  }: {
    label?: string;
    href?: string | undefined;
    onclick?: (() => void) | undefined;
    tone?: ChipTone;
    size?: ChipSize;
    color?: string | undefined;
    touch?: boolean;
    selected?: boolean;
    tintAtRest?: boolean;
    ghost?: boolean;
    dot?: boolean;
    count?: number | null;
    mono?: boolean;
    disabled?: boolean;
    title?: string | undefined;
    ariaLabel?: string | undefined;
    ariaPressed?: boolean | undefined;
    ariaCurrent?: 'page' | 'true' | undefined;
    ariaSelected?: boolean | undefined;
    role?: string | undefined;
    tabindex?: number | undefined;
    leading?: Snippet;
    children?: Snippet;
    class?: string;
  } = $props();

  const style = $derived(chipStyle(tone, color));
  const classes = $derived(
    chipClass({ tone, size, color, tintAtRest, ghost, touch, mono, selected, disabled, className })
  );
</script>

{#snippet body()}
  {#if dot}
    <span class="chip-dot" aria-hidden="true"></span>
  {/if}
  {@render leading?.()}
  {#if children}
    {@render children()}
  {:else}
    <span class="chip-label">{label}</span>
  {/if}
  {#if count != null}
    <span class="chip-count" class:is-zero={count === 0}>{count.toLocaleString()}</span>
  {/if}
{/snippet}

<!-- Three explicit elements rather than one <svelte:element>: a chip that is a
     link, a chip that is a control and a chip that is a label have three
     different sets of attributes, and a <svelte:element> carrying a click
     handler cannot be given the right role for all of them. The shape is one
     rule either way -- see the styles below. -->
{#if href}
  <a
    class={classes}
    style={style}
    {href}
    {title}
    aria-label={ariaLabel}
    aria-current={ariaCurrent}
    aria-disabled={disabled ? 'true' : undefined}
    {onclick}
  >
    {@render body()}
  </a>
{:else if onclick}
  <button
    type="button"
    class={classes}
    style={style}
    {title}
    {disabled}
    {role}
    {tabindex}
    aria-label={ariaLabel}
    aria-pressed={ariaPressed}
    aria-current={ariaCurrent}
    aria-selected={ariaSelected}
    {onclick}
  >
    {@render body()}
  </button>
{:else}
  <span class={classes} style={style} {title} aria-label={ariaLabel}>
    {@render body()}
  </span>
{/if}

<style>
  /* THE pill shape, declared once. The --weeb-pill-* tokens are read here and
     nowhere else in the app. */
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--weeb-pill-gap);
    min-height: var(--weeb-pill-min-height);
    padding: var(--weeb-pill-padding-y) var(--weeb-pill-padding-x);
    border-radius: var(--weeb-pill-radius);
    border: 1px solid var(--weeb-border);
    background: var(--weeb-surface);
    color: var(--weeb-fg-secondary);
    font-family: var(--weeb-font);
    font-size: var(--weeb-pill-font-size);
    font-weight: var(--weeb-pill-font-weight);
    line-height: 1;
    white-space: nowrap;
    text-decoration: none;
    flex-shrink: 0;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }

  /* Dense metadata: a type badge beside a title, a category beside a date.
     11px is the floor of the documented 11-13px label ramp -- `Tag` used to sit
     at 16px and `row-type-badge` at 10px, one either side of it. */
  .chip--sm {
    gap: 4px;
    min-height: 20px;
    padding: 2px 8px;
    font-size: 11px;
  }

  /* A row that is a page's primary way through it. The second of the two
     heights the design system defines, and the only other one. */
  .chip--touch {
    min-height: var(--weeb-pill-min-height-touch);
  }

  .chip--mono {
    font-family: var(--weeb-font-mono);
    font-variant-numeric: tabular-nums;
  }

  /* A toned chip states something -- "airing", "announcement", "TV" -- so it
     carries its colour at rest, at the low tint that keeps a row of them calm. */
  .chip--toned {
    color: var(--chip-color);
    border-color: color-mix(in oklch, var(--chip-color) 40%, var(--weeb-border));
    background: color-mix(in oklch, var(--chip-color) 12%, transparent);
  }

  /* Transparent ground: a chip in a row you switch on and off shows nothing
     until it is on, so the selected wash is the only fill in the row. */
  .chip--ghost:not(.chip--toned) {
    background: transparent;
  }

  /* Interactive only. A static chip is not a target and must not light up. */
  a.chip:hover:not(.selected):not(.is-disabled),
  button.chip:hover:not(.selected):not(:disabled) {
    border-color: var(--chip-color);
    color: var(--weeb-fg);
    background: var(--weeb-surface-hover);
  }
  /* A ghost chip has no ground to lift, so its hover is a wash of its own
     colour -- the same gesture as the selected state, at a quarter strength. */
  a.chip--ghost:hover:not(.selected):not(.is-disabled),
  button.chip--ghost:hover:not(.selected):not(:disabled) {
    background: color-mix(in oklch, var(--chip-color) 8%, transparent);
  }
  a.chip:focus-visible,
  button.chip:focus-visible {
    outline: 2px solid var(--weeb-accent);
    outline-offset: 2px;
  }
  button.chip {
    cursor: pointer;
  }
  a.chip {
    cursor: pointer;
  }

  /* The selected state: a wash of the chip's own colour rather than a second
     border weight. Every selectable row in the app is this rule. */
  .chip.selected {
    background: color-mix(in oklch, var(--chip-color) 18%, transparent);
    border-color: var(--chip-color);
    color: var(--weeb-accent-text);
  }
  /* A chip with a colour of its own keeps the neutral foreground when selected:
     the wash and the dot already say which one it is, and four different text
     colours in one row would not. */
  .chip--colored.selected {
    color: var(--weeb-fg);
    border-color: color-mix(in oklch, var(--chip-color) 65%, transparent);
    background: color-mix(in oklch, var(--chip-color) 15%, transparent);
  }

  button.chip:disabled,
  .chip.is-disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .chip-dot {
    width: 6px;
    height: 6px;
    border-radius: var(--weeb-radius-full);
    background: var(--chip-color);
    flex-shrink: 0;
  }
  .chip:not(.chip--colored):not(.selected) .chip-dot {
    background: var(--weeb-fg-muted);
  }

  .chip-label {
    display: inline-block;
    min-width: 0;
  }

  /* The one count-badge treatment: mono, tabular, on the hover surface, tinted
     while its chip is selected, and transparent at 0 so an empty facet recedes. */
  .chip-count {
    font-family: var(--weeb-font-mono);
    font-size: var(--weeb-pill-count-font-size);
    /* Its own, so a skin that gives the chip a taller line (the underline row)
       does not stretch the badge with it. */
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
  .chip-count.is-zero {
    background: transparent;
    color: var(--weeb-fg-muted);
  }
  .chip.selected .chip-count {
    background: color-mix(in oklch, var(--chip-color) 18%, transparent);
    color: var(--weeb-accent-text);
  }

  @media (prefers-reduced-motion: reduce) {
    .chip,
    .chip-count {
      transition: none;
    }
  }
</style>
