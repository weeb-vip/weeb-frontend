<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { breadcrumbSchema } from '$lib/structured-data';
  import WorksBrowsePage from '../../svelte/components/WorksBrowsePage.svelte';
  import { shelfLabel } from '../../services/api/graphql/works';

  export let data;

  const SITE_URL = 'https://weeb.vip';
  const canonical = `${SITE_URL}/light-novels`;

  $: pageTitle = data.sort
    ? `Light novels · ${shelfLabel(data.sort)}${data.page > 1 ? ` — page ${data.page}` : ''}`
    : 'Light novels';

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
  shelves={data.shelves}
  works={data.works}
  sort={data.sort}
  total={data.total}
  page={data.page}
  totalPages={data.totalPages}
  ssrError={data.ssrError}
/>
