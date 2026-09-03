<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { breadcrumbSchema } from '$lib/structured-data';
  import WorksBrowsePage from '../../svelte/components/WorksBrowsePage.svelte';

  export let data;

  const SITE_URL = 'https://weeb.vip';
  const canonical = `${SITE_URL}/manga`;

  // Only page one is canonical to itself; deeper pages point back at it rather
  // than competing with it for the same query.
  $: pageTitle = data.page > 1 ? `Manga — page ${data.page}` : 'Manga';

  $: schemas = [
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: 'Manga', url: canonical }
    ])
  ];
</script>

<Seo
  title={pageTitle}
  description="Browse manga — series, one-shots and everything anime gets adapted from."
/>

<StructuredData {schemas} />

<WorksBrowsePage
  heading="Manga"
  blurb="Series, one-shots and everything anime gets adapted from."
  basePath="/manga"
  works={data.works}
  total={data.total}
  page={data.page}
  totalPages={data.totalPages}
  sort={data.sort}
  ssrError={data.ssrError}
/>
