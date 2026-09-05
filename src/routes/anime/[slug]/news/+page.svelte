<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { breadcrumbSchema } from '$lib/structured-data';
  import AnimeNewsPage from '../../../../svelte/components/AnimeNewsPage.svelte';

  let { data }: { data: any } = $props();

  const SITE_URL = 'https://weeb.vip';

  const total = $derived((data.news ?? []).length);
  // Trailing "." on a title would otherwise produce "…Last Stand.." in the description.
  const descTitle = $derived(data.animeTitle.replace(/\.+$/, ''));
  const breadcrumbs = $derived(
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: data.animeTitle, url: `${SITE_URL}/anime/${data.animeSlug}` },
      { name: 'News', url: `${SITE_URL}/anime/${data.animeSlug}/news` }
    ])
  );
</script>

<Seo
  title={`${data.animeTitle} — News`}
  description={`All ${total} news ${total === 1 ? 'story' : 'stories'} for ${descTitle}.`}
  image={data.animeImage}
/>

<StructuredData schemas={[breadcrumbs]} />

<AnimeNewsPage {data} />
