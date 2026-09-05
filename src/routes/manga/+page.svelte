<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { breadcrumbSchema } from '$lib/structured-data';
  import WorksBrowsePage from '../../svelte/components/WorksBrowsePage.svelte';
  import { shelfLabel } from '../../services/api/graphql/works';

  let { data }: { data: any } = $props();

  const SITE_URL = 'https://weeb.vip';
  const canonical = `${SITE_URL}/manga`;

  // The shelf a reader opened, and how deep, both belong in the tab title --
  // it is what tells two open tabs of this page apart.
  const pageTitle = $derived(
    data.sort
      ? `Manga · ${shelfLabel(data.sort)}${data.page > 1 ? ` — page ${data.page}` : ''}`
      : 'Manga'
  );

  const schemas = $derived([
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: 'Manga', url: canonical }
    ])
  ]);
</script>

<Seo
  title={pageTitle}
  description="Browse manga, manhwa, manhua and one-shots — everything anime gets adapted from."
/>

<StructuredData {schemas} />

<WorksBrowsePage
  heading="Manga"
  blurb="Manga, manhwa, manhua and one-shots — everything anime gets adapted from."
  basePath="/manga"
  shelves={data.shelves}
  works={data.works}
  sort={data.sort}
  total={data.total}
  page={data.page}
  totalPages={data.totalPages}
  ssrError={data.ssrError}
/>
