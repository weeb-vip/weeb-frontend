<script lang="ts" module>
  export interface ChipRowItem {
    label: string;
    /** A link chip. Omit for a plain badge. */
    href?: string;
    title?: string;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Chip, { type ChipSize, type ChipTone } from './Chip.svelte';

  /**
   * A wrapping row of `Chip`s.
   *
   * This is what is left of `GenrePills` once the sixteen hardcoded genre names
   * inside it moved out to `$lib/data/genres`. That component was not a genre
   * component at all -- the homepage called `<GenrePills />` with no props, so
   * it ran entirely on a taxonomy that existed nowhere else in the codebase. A
   * presentational primitive does not own the site's taxonomy; it owns the row
   * gap and nothing else.
   *
   * Presentational -- no bloc.
   */
  let {
    items = [],
    tone = 'neutral',
    size = 'md',
    touch = false,
    ariaLabel = undefined,
    /** Chips the caller builds itself, rendered after `items`. */
    children,
    class: className = '',
  }: {
    items?: ChipRowItem[];
    tone?: ChipTone;
    size?: ChipSize;
    touch?: boolean;
    ariaLabel?: string | undefined;
    children?: Snippet;
    class?: string;
  } = $props();
</script>

<div class="chip-row {className}" aria-label={ariaLabel} role={ariaLabel ? 'group' : undefined}>
  {#each items as item (item.label)}
    <Chip label={item.label} href={item.href} title={item.title} {tone} {size} {touch} />
  {/each}
  {@render children?.()}
</div>

<style>
  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--weeb-pill-row-gap);
  }
</style>
