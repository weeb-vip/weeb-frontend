<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { breadcrumbSchema } from '$lib/structured-data';
  import SeriesPage from '../../../svelte/components/SeriesPage.svelte';
  import { seriesHref } from '../../../services/utils';

  export let data;

  const SITE_URL = 'https://weeb.vip';

  // Built from the id and the anchor's current slug rather than from the URL
  // that was requested, so the breadcrumb names one page however it was reached.
  $: canonical = `${SITE_URL}${seriesHref(data.seriesId, data.seriesSlug)}`;
  $: schemas = [
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: data.seriesTitle, url: canonical }
    ])
  ];
</script>

<Seo title={data.seriesTitle} description={data.seriesDescription} image={data.seriesImage} />
<StructuredData {schemas} />

<SeriesPage
  entries={data.ssrEntries}
  seriesTitle={data.seriesTitle}
  ssrError={data.ssrError}
/>
