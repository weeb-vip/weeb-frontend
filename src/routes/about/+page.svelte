<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import AboutPage from '../../svelte/components/AboutPage.svelte';
</script>

<!-- Seo appends "| WeebVIP", so "About WeebVIP" rendered as "About WeebVIP | WeebVIP". -->
<Seo
  title="About"
  description="Learn about WeebVIP - the ultimate platform for tracking your anime watchlist, getting episode notifications, and discovering new seasonal anime."
/>

<AboutPage />
