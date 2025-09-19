<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeQueryClient } from '../services/query-client';

  let QueryClientProvider: any = null;
  let queryClient: any = null;
  let isClient = false;

  onMount(async () => {
    // Dynamic import to avoid SSR issues
    const { QueryClientProvider: QCP } = await import('@tanstack/svelte-query');
    QueryClientProvider = QCP;
    queryClient = initializeQueryClient();
    isClient = true;
  });
</script>

{#if isClient && QueryClientProvider && queryClient}
  <svelte:component this={QueryClientProvider} client={queryClient}>
    <slot />
  </svelte:component>
{:else}
  <!-- Fallback during SSR or before client loads -->
  <slot />
{/if}