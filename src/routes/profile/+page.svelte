<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import ProfilePage from '../../svelte/components/ProfilePage.svelte';

  export let data;
</script>

<Seo
  title="Profile"
  description="Manage your anime watchlist, settings, and profile information."
  noIndex={true}
/>

<ProfilePage ssr={data.ssr} />
