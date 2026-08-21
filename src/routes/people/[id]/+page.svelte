<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { breadcrumbSchema } from '$lib/structured-data';
  import VoiceActorPage from '../../../svelte/components/VoiceActorPage.svelte';

  export let data;

  const SITE_URL = 'https://weeb.vip';

  // The canonical host rather than the request origin, matching the anime
  // route: these URLs identify the entity and must agree with the canonical tag
  // whichever deployment served the page.
  $: canonical = `${SITE_URL}/people/${data.staffId}`;
  $: schemas = [
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: data.staffName, url: canonical }
    ])
  ];
</script>

<Seo title={data.staffName} description={data.staffDescription} />

<StructuredData {schemas} />

<VoiceActorPage staff={data.staff} ssrError={data.ssrError} />
