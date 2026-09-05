<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import ProfileList from '../../../svelte/components/ProfileList.svelte';

  let { data }: { data: any } = $props();
</script>

<Seo
  title="My List"
  description="Manage your anime watchlist and manga reading list, and track your progress."
  noIndex={true}
/>

<ProfileList ssr={data.ssr} />
