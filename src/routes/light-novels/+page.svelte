<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { breadcrumbSchema } from '$lib/structured-data';
  import WorksBrowsePage from '../../svelte/components/WorksBrowsePage.svelte';
  import { shelfLabel } from '../../services/api/graphql/works';

  let { data }: { data: any } = $props();

  const SITE_URL = 'https://weeb.vip';
  const canonical = `${SITE_URL}/light-novels`;

  const pageTitle = $derived(
    data.sort
      ? `Light novels · ${shelfLabel(data.sort)}${data.page > 1 ? ` — page ${data.page}` : ''}`
      : 'Light novels'
  );

  const schemas = $derived([
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: 'Light novels', url: canonical }
    ])
  ]);
</script>

<Seo
  title={pageTitle}
  description="Browse light novels and novels — the source behind a great many of the season's anime."
/>

<StructuredData {schemas} />

<WorksBrowsePage
  heading="Light novels"
  blurb="Light novels and novels — the source behind a great many of the season's anime."
  basePath="/light-novels"
  shelves={data.shelves}
  works={data.works}
  sort={data.sort}
  total={data.total}
  page={data.page}
  totalPages={data.totalPages}
  ssrError={data.ssrError}
/>
