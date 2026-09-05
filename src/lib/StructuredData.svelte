<script lang="ts">
  import { serializeJsonLd } from './structured-data';

  let {
    /** One schema object, or several to emit as separate blocks. Nulls are skipped. */
    schemas = [],
  }: { schemas?: (Record<string, unknown> | null)[] } = $props();

  const present = $derived(schemas.filter((s): s is Record<string, unknown> => Boolean(s)));
</script>

<svelte:head>
  {#each present as schema}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- serializeJsonLd escapes "<" -->
    {@html `<script type="application/ld+json">${serializeJsonLd(schema)}<\/script>`}
  {/each}
</svelte:head>
