<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { itemListSchema, breadcrumbSchema } from '$lib/structured-data';
  import CurrentlyAiringPage from '../../svelte/components/CurrentlyAiringPage.svelte';

  let { data } = $props();

  const SITE_URL = 'https://weeb.vip';

  const canonical = `${SITE_URL}/airing`;
  const schemas = $derived([
    itemListSchema(data.ssrData?.currentlyAiring, {
      name: 'Currently Airing Anime',
      url: canonical,
      siteUrl: SITE_URL
    }),
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: 'Currently Airing', url: canonical }
    ])
  ]);
</script>

<Seo
  title="Currently Airing Anime"
  description="Discover what anime is currently airing this season. Get episode schedules, notifications, and add shows to your watchlist."
/>

<StructuredData {schemas} />

<CurrentlyAiringPage ssrData={data.ssrData} />
