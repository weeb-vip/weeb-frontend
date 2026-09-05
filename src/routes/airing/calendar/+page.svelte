<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import AiringCalendar from '../../../svelte/components/AiringCalendar.svelte';

  let { data } = $props();
</script>

<Seo
  title="Airing Calendar"
  description="View anime airing schedule in a calendar format. See episodes by date and plan your watching schedule."
/>

<AiringCalendar
  ssrData={data.ssrData}
  ssrError={data.ssrError}
  isTokenExpired={data.isTokenExpired}
/>
