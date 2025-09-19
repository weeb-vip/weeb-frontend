<script lang="ts">
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { initializeQueryClient } from '../services/query-client';
  import ShowContent from './ShowContent.svelte';

  export let animeId: string;

  // Initialize query client
  const queryClient = initializeQueryClient();
</script>

<QueryClientProvider client={queryClient}>
  <ShowContent {animeId} />
</QueryClientProvider>