<script lang="ts">
  import { page } from '$app/stores';
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { animeSchema, breadcrumbSchema } from '$lib/structured-data';
  import ShowContentWithProvider from '../../../svelte/components/ShowContentWithProvider.svelte';

  let { data }: { data: any } = $props();

  const SITE_URL = 'https://weeb.vip';

  // Canonical host, not the request origin: these URLs identify the entity, and must
  // match the canonical tag rather than whichever deployment served the page.
  const canonical = $derived(`${SITE_URL}/anime/${data.animeSlug}`);
  const schemas = $derived([
    data.animeSchemaSource
      ? animeSchema(data.animeSchemaSource, canonical, new URL(data.animeImage, $page.url.origin).toString())
      : null,
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: data.animeTitle, url: canonical }
    ])
  ]);
</script>

<Seo
  title={data.animeTitle}
  description={data.animeDescription}
  image={data.animeImage}
/>

<StructuredData {schemas} />

{#key data.animeId}
  <ShowContentWithProvider
    animeId={data.animeId}
    ssrAnimeData={data.ssrAnimeData}
    ssrCharactersData={data.ssrCharactersData}
    ssrError={data.ssrError}
  />
{/key}
