<script lang="ts">
  import { onMount } from 'svelte';
  import { loggedInStore } from '../stores/auth';
  import { AuthStorage } from '../../utils/auth-storage';
  import { TokenRefresher } from '../../services/token_refresher';
  import { refreshTokenSimple } from '../../services/queries';
  import debug from '../../utils/debug';

  onMount(async () => {
    try {
      debug.auth("Initializing auth state");

      // Check if we have tokens
      const authToken = AuthStorage.getAuthToken();
      const refreshToken = AuthStorage.getRefreshToken();

      if (authToken && refreshToken) {
        debug.auth("Found existing tokens, setting logged in state");
        loggedInStore.setLoggedIn();

        // Start token refresher
        try {
          TokenRefresher.getInstance(async () => {
            return refreshTokenSimple();
          }).start(authToken);
        } catch (error) {
          debug.error("Failed to start token refresher:", error);
        }
      } else {
        debug.auth("No tokens found, user not logged in");
        loggedInStore.setAuthInitialized();
      }
    } catch (error) {
      debug.error("Auth initialization failed:", error);
      loggedInStore.setAuthInitialized();
    }
  });
</script>

<!-- This component doesn't render anything, it just initializes auth state -->