<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import CurrentlyAiringPage from '../../svelte/components/CurrentlyAiringPage.svelte';

  export let data;
</script>

<Seo
  title="Currently Airing Anime"
  description="Discover what anime is currently airing this season. Get episode schedules, notifications, and add shows to your watchlist."
/>

<CurrentlyAiringPage
  ssrData={data.ssrData}
  ssrError={data.ssrError}
  isTokenExpired={data.isTokenExpired}
/>
