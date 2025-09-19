<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeAnimeNotifications } from '../stores/animeNotificationProvider';
  import debug from '../../utils/debug';

  // onMount only runs on the client, so we can safely check window there
  onMount(async () => {
    // Use a global flag to ensure we only initialize once per browser session
    // This persists across page navigations but resets on page refresh
    if (!window.__animeNotificationsComponentMounted) {
      window.__animeNotificationsComponentMounted = true;

      debug.info('🔔 AnimeNotificationProvider: Checking initialization status');
      // The singleton manager in the store handles duplicate initialization checks
      await initializeAnimeNotifications();
    }
  });
</script>

<!-- This component doesn't render anything visible -->
