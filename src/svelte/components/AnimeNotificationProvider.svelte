<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { initializeAnimeNotifications, cleanupAnimeNotifications } from '../stores/animeNotificationProvider';

  // Initialize the anime notifications system on mount
  onMount(async () => {
    await initializeAnimeNotifications();
  });

  // Cleanup on destroy
  onDestroy(() => {
    cleanupAnimeNotifications();
  });
</script>

<!-- This component doesn't render anything visible -->