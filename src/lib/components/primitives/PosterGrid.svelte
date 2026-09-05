<script lang="ts">
  /*
    The poster grid, in one place.

    Every page that lays out poster cards used to declare its own, and they
    disagreed. On a phone the homepage gave two columns, the season page about
    three, the profile list exactly three and the profile page two -- so the
    same card was a different size depending on how you arrived at it.

    Three across on a phone, which is what the season and profile-list grids
    were already doing. Above that the column count is deliberately not fixed:
    auto-fill with 1fr tracks fills the row whatever the item count, which is
    what lets a shelf of seven and a page of forty look like the same grid.
  */

  import type { Snippet } from 'svelte';

  let {
    /** Reserve height so the layout does not jump while a page loads. */
    minHeight = null,
    /** Dim the grid during a refetch, without collapsing it. */
    loading = false,
    class: className = '',
    children,
  }: {
    minHeight?: string | null;
    loading?: boolean;
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<div
  class="poster-grid {className}"
  class:loading
  style={minHeight ? `min-height: ${minHeight};` : ''}
>
  {@render children?.()}
</div>

<style>
  .poster-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 16px;
    align-items: start;
    width: 100%;
    transition: opacity 0.2s ease;
  }

  /* :global because the cards are slotted in by the caller, so Svelte's scoping
     does not reach them. */
  .poster-grid > :global(*) {
    width: 100%;
    max-width: 220px;
    justify-self: center;
  }

  .poster-grid.loading {
    opacity: 0.4;
    pointer-events: none;
  }

  @media (min-width: 1400px) {
    .poster-grid {
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    }
    .poster-grid > :global(*) { max-width: 240px; }
  }

  @media (min-width: 1800px) {
    .poster-grid {
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    }
    .poster-grid > :global(*) { max-width: 260px; }
  }

  /* Phones get an exact count rather than auto-fill. At these widths auto-fill
     is what made the pages disagree: a 40px difference in page padding was
     enough to drop a column, so two pages with the same rule still rendered
     differently. */
  @media (max-width: 767px) {
    .poster-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .poster-grid > :global(*) { max-width: none; }
  }

  @media (max-width: 400px) {
    .poster-grid { gap: 10px; }
  }
</style>
