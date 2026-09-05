<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { breadcrumbSchema } from '$lib/structured-data';
  import MangaContent from '../../../svelte/components/MangaContent.svelte';

  let { data }: { data: any } = $props();

  const SITE_URL = 'https://weeb.vip';

  // Canonical host, not the request origin: this URL identifies the work and has
  // to match the canonical tag rather than whichever deployment served it.
  const canonical = $derived(`${SITE_URL}/manga/${data.slug}`);
  const schemas = $derived([
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: data.workTitle, url: canonical }
    ])
  ]);
</script>

<Seo title={data.workTitle} description={data.workDescription} image={data.workImage} />
<StructuredData {schemas} />

<MangaContent work={data.ssrWork} ssrError={data.ssrError} />
