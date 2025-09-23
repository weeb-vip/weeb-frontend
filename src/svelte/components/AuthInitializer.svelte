<script lang="ts">
  import { onMount } from 'svelte';
  import { loggedInStore, loginModalStore } from '../stores/auth';
  import { AuthStorage } from '../../utils/auth-storage';
  import { TokenRefresher } from '../../services/token_refresher';
  import { refreshTokenSimple, getUser } from '../../services/queries';
  import { createQuery } from '@tanstack/svelte-query';
  import { getQueryClient } from '../services/query-client';
  import debug from '../../utils/debug';

  // Accept SSR auth data to avoid unnecessary GraphQL calls
  export let ssrAuth: {
    isLoggedIn: boolean;
    authToken: string | undefined;
    refreshToken: string | undefined;
    hasAuthToken: boolean;
    hasRefreshToken: boolean;
  } | undefined = undefined;

  let currentLoggedInState: any = { isLoggedIn: false, isAuthInitialized: false };

  onMount(async () => {
    try {
      // Expose auth stores globally for error toast functionality
      if (typeof window !== 'undefined') {
        window.loggedInStore = loggedInStore;
        window.loginModalStore = loginModalStore;

        // Subscribe to store changes and keep current value available
        loggedInStore.subscribe((state) => {
          currentLoggedInState = state;
          window.loggedInStoreValue = state;
        });
      }
      // If we have SSR auth data, use it instead of making GraphQL calls
      if (ssrAuth) {
        debug.auth("Using SSR auth data - skipping GraphQL user query");

        if (ssrAuth.isLoggedIn && ssrAuth.hasAuthToken) {
          debug.success("SSR data shows user is logged in");

          // Fetch user data for PostHog identification
          try {
            const { getUserQuery } = await import('../../services/queries');
            const queryConfig = getUserQuery();
            const userData = await queryConfig.queryFn();

            loggedInStore.setLoggedIn({
              id: userData.id,
              username: userData.username,
              email: userData.email
            });
          } catch (error) {
            debug.warn("Failed to fetch user data for analytics:", error);
            // Still set logged in, just without PostHog identification
            loggedInStore.setLoggedIn();
          }

          // Start token refresher if we have refresh capabilities
          if (ssrAuth.hasRefreshToken && ssrAuth.authToken) {
            TokenRefresher.getInstance(async () => {
              return refreshTokenSimple();
            }).start(ssrAuth.authToken);
          }
        } else {
          debug.auth("SSR data shows user is not logged in");
          loggedInStore.logout();
        }

        // Mark auth as initialized
        loggedInStore.setAuthInitialized();
        return;
      }

      debug.auth("No SSR auth data - initializing auth state via user details query");

      // Create a query client for this auth check
      const queryClient = getQueryClient();

      // Attempt to fetch user details to determine auth state
      const userQuery = createQuery(getUser(), queryClient);

      // Subscribe to the query result
      const unsubscribe = userQuery.subscribe((result) => {
        if (result.isSuccess && result.data) {
          debug.success("User details fetched successfully - user is logged in");
          loggedInStore.setLoggedIn({
            id: result.data.id,
            username: result.data.username,
            email: result.data.email
          });

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