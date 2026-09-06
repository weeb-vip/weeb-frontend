<script lang="ts">
  import { untrack } from 'svelte';
  import { useQueryClient } from '@tanstack/svelte-query';

  /**
   * Test support: a child that does what every real child of `QueryProvider`
   * does -- reach for the QueryClient during its own initialisation.
   * `useQueryClient` throws when there is none, so simply mounting this inside
   * a provider is the assertion.
   */
  let { onClient }: { onClient: (client: unknown) => void } = $props();

  // See ContextProbe: reading the prop in the init body is the point.
  untrack(() => onClient(useQueryClient()));
</script>

<span data-testid="query-probe">child</span>
