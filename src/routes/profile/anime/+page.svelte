<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import ProfileAnimeList from '../../../svelte/components/ProfileAnimeList.svelte';
</script>

<Seo
  title="My Anime List"
  description="Manage your anime watchlist and track your viewing progress."
  noIndex={true}
/>

<ProfileAnimeList />
