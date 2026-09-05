<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { itemListSchema, breadcrumbSchema } from '$lib/structured-data';
  import SeasonPage from '../../../svelte/components/SeasonPage.svelte';

  let { data } = $props();

  const SITE_URL = 'https://weeb.vip';

  const canonical = $derived(`${SITE_URL}/season/${data.season}`);
  const schemas = $derived([
    itemListSchema(data.seasonalData?.animeBySeasons, {
      name: `${data.displayName} Anime`,
      url: canonical,
      siteUrl: SITE_URL
    }),
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: `${data.displayName} Anime`, url: canonical }
    ])
  ]);
</script>

<Seo
  title={`${data.displayName} Anime`}
  description={`Browse all anime from the ${data.displayName} season. Discover new shows, check ratings, and add them to your watchlist.`}
/>

<StructuredData {schemas} />

{#key data.season}
  <SeasonPage
    seasonalData={data.seasonalData}
    season={data.season}
    ssrError={data.ssrError}
  />
{/key}
