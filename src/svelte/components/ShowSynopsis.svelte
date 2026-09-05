<script lang="ts">
  import EmptyState from './EmptyState.svelte';

  /**
   * The synopsis, capped at a readable measure.
   *
   * Presentational -- no bloc. It renders one string or says there isn't one.
   */
  let { description = '' }: { description?: string | null } = $props();
</script>

{#if description}
  <div class="synopsis-text">
    <p>{description}</p>
  </div>
{:else}
  <!-- A missing synopsis is a gap in the catalogue, not a failure, so it says
       so plainly rather than leaving a heading over nothing. -->
  <EmptyState
    size="compact"
    headingTag="p"
    heading="No synopsis yet"
    message="Nobody has written one for this show in the sources we read."
  />
{/if}

<style>
  /* Width is for content that tiles; prose keeps its own measure. */
  .synopsis-text {
    font-size: 15px;
    line-height: 1.8;
    color: var(--weeb-fg-secondary);
    max-width: 80ch;
  }
</style>
