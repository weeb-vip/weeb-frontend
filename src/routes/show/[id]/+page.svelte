<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import ShowContentWithProvider from '../../../svelte/components/ShowContentWithProvider.svelte';

  export let data;
</script>

<Seo
  title={data.animeTitle}
  description={data.animeDescription}
  image={data.animeImage}
/>

{#key data.animeId}
  <ShowContentWithProvider
    animeId={data.animeId}
    ssrAnimeData={data.ssrAnimeData}
    ssrCharactersData={data.ssrCharactersData}
    ssrError={data.ssrError}
    streamingEnabled={data.streamingEnabled}
  />
{/key}
