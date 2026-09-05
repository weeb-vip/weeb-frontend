<script lang="ts">
  import QueryProvider from './QueryProvider.svelte';
  import ShowContent from './ShowContent.svelte';

  /**
   * The show page's entry point: the query client, and the page under it.
   * Routes mount this rather than `ShowContent` directly, so the client comes
   * from the one place that makes it -- a fresh one per SSR request, the shared
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
</script>

<QueryProvider>
  <ShowContent {animeId} {ssrAnimeData} {ssrCharactersData} {ssrError} />
</QueryProvider>
