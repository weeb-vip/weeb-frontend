<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import HomepageSSR from '../svelte/components/HomepageSSR.svelte';

  export let data;
</script>

<!-- No title, so Seo falls back to "WeebVIP - Track Your Anime Watchlist". This is the
     most-linked page on the site and "Home | WeebVIP" says nothing about what it is. -->
<Seo
  description="Discover and track your favorite anime. Get notifications for new episodes, explore seasonal anime, and manage your watchlist."
/>

<svelte:head>
  {#if data.bannerImageUrl}
    <link rel="preload" as="image" href={data.bannerImageUrl} fetchpriority="high" />
  {/if}
</svelte:head>

<HomepageSSR
  homeData={data.homeData}
  currentlyAiringData={data.currentlyAiringData}
  seasonalData={data.seasonalData}
  publishingWorksData={data.publishingWorksData}
  currentSeason={data.currentSeason}
  isTokenExpired={data.isTokenExpired}
/>
