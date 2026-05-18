<script lang="ts">
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { initializeQueryClient } from '../services/query-client';
  import ShowContent from './ShowContent.svelte';

  export let animeId: string;
  export let ssrAnimeData: any = null;
  export let ssrCharactersData: any = null;
  export let ssrError: any = null;

  // Initialize query client
  const queryClient = initializeQueryClient();
</script>

<QueryClientProvider client={queryClient}>
  <ShowContent {animeId} {ssrAnimeData} {ssrCharactersData} {ssrError} />
</QueryClientProvider>