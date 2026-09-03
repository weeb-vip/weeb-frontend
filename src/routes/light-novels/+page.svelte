<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { breadcrumbSchema } from '$lib/structured-data';
  import WorksBrowsePage from '../../svelte/components/WorksBrowsePage.svelte';

  export let data;

  const SITE_URL = 'https://weeb.vip';
  const canonical = `${SITE_URL}/light-novels`;

  $: pageTitle = data.page > 1 ? `Light novels — page ${data.page}` : 'Light novels';

  $: schemas = [
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: 'Light novels', url: canonical }
    ])
  ];
</script>

<Seo
  title={pageTitle}
  description="Browse light novels — the source behind a great many of the season's anime."
/>

<StructuredData {schemas} />

<WorksBrowsePage
  heading="Light novels"
  blurb="The source behind a great many of the season's anime."
  basePath="/light-novels"
  works={data.works}
  total={data.total}
  page={data.page}
  totalPages={data.totalPages}
  sort={data.sort}
  ssrError={data.ssrError}
/>
