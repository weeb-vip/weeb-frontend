<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * One block of the show page: a rule-trailed heading and whatever sits under
   * it. Six sections used to repeat this pair of elements plus the
   * `aria-labelledby` wiring by hand, and the scroll spy needed a `bind:this`
   * from each of them; both are now this component's job.
   *
   * Presentational -- no bloc. The `id` is what the spy and the section links
   * address, so it has to be stable and it has to be the caller's choice.
   */
  let {
    id,
    heading,
    children,
  }: {
    /** DOM id, from `sectionElementId()`. Also seeds the heading's id. */
    id: string;
    heading: string;
    children: Snippet;
  } = $props();
</script>

<section class="content-section" {id} aria-labelledby="{id}-heading">
  <h2 class="section-heading" id="{id}-heading">{heading}</h2>
  {@render children()}
</section>

<style>
  .section-heading {
    font-family: var(--weeb-font);
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--weeb-fg);
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* The rule runs from the end of the words to the edge of the column, so the
     heading measures the section rather than floating above it. */
  .section-heading::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--weeb-border);
  }
</style>
