<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import SeasonPage from '../../../svelte/components/SeasonPage.svelte';

  export let data;
</script>

<Seo
  title={`${data.displayName} Anime`}
  description={`Browse all anime from the ${data.displayName} season. Discover new shows, check ratings, and add them to your watchlist.`}
/>

{#key data.season}
  <SeasonPage
    seasonalData={data.seasonalData}
    season={data.season}
    ssrError={data.ssrError}
    isTokenExpired={data.isTokenExpired}
  />
{/key}
