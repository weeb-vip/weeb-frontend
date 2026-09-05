<script lang="ts">
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { initializeQueryClient } from '../services/query-client';
  import ShowContent from './ShowContent.svelte';

  /**
   * The show page's entry point: the query client, and the page under it.
   * Routes mount this rather than `ShowContent` directly, so the client is
   * created once per render context -- a fresh one per SSR request, the shared
   * one in the browser.
   */
  let {
    animeId,
    ssrAnimeData = null,
    ssrCharactersData = null,
    ssrError = null,
  }: {
    animeId: string;
    ssrAnimeData?: any;
    ssrCharactersData?: any;
    ssrError?: any;
  } = $props();

  const queryClient = initializeQueryClient();
</script>

<QueryClientProvider client={queryClient}>
  <ShowContent {animeId} {ssrAnimeData} {ssrCharactersData} {ssrError} />
</QueryClientProvider>
