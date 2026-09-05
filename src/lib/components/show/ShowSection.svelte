<script lang="ts">
  import type { Snippet } from 'svelte';
  import SectionHeader from '$lib/components/primitives/SectionHeader.svelte';

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
  <SectionHeader title={heading} id="{id}-heading" size="sub" rule />
  {@render children()}
</section>
