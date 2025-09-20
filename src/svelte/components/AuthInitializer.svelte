<script lang="ts">
  import { onMount } from 'svelte';
  import { loggedInStore } from '../stores/auth';
  import { AuthStorage } from '../../utils/auth-storage';
  import { TokenRefresher } from '../../services/token_refresher';
  import { refreshTokenSimple, getUser } from '../../services/queries';
  import { createQuery } from '@tanstack/svelte-query';
  import { getQueryClient } from '../services/query-client';
  import debug from '../../utils/debug';

  onMount(async () => {
    try {
      debug.auth("Initializing auth state via user details query");

      // Create a query client for this auth check
      const queryClient = getQueryClient();

      // Attempt to fetch user details to determine auth state
      const userQuery = createQuery(getUser(), queryClient);

      // Subscribe to the query result
      const unsubscribe = userQuery.subscribe((result) => {
        if (result.isSuccess && result.data) {
          debug.success("User details fetched successfully - user is logged in");
          loggedInStore.setLoggedIn();

          // Start token refresher if we have refresh capabilities
          const refreshToken = AuthStorage.getRefreshToken();
          if (refreshToken) {
            TokenRefresher.getInstance(async () => {
              return refreshTokenSimple();
            }).start(AuthStorage.getAuthToken() || '');
          }
        } else if (result.isError) {
          debug.auth("User details query failed - user is not logged in:", result.error?.message);
          loggedInStore.logout();
          AuthStorage.clearTokens();
        }

        // Mark auth as initialized regardless of success/failure
        loggedInStore.setAuthInitialized();
      });

      // Clean up subscription on component destroy
      return () => {
        unsubscribe();
      };
    } catch (error) {
      debug.error("Auth initialization failed:", error);
      loggedInStore.logout();
      loggedInStore.setAuthInitialized();
    }
  });
</script>

<!-- This component doesn't render anything, it just initializes auth state -->