<script lang="ts">
  import { onMount } from 'svelte';
  import { loggedInStore, loginModalStore } from '../stores/auth';
  import { preferencesStore } from '../stores/preferences';
  import { AuthStorage } from '../../utils/auth-storage';
  import { TokenRefresher } from '../../services/token_refresher';
  import { refreshTokenSimple, getUser } from '../../services/queries';
  import { createQuery } from '@tanstack/svelte-query';
  import { getQueryClient } from '../services/query-client';
  import debug from '../../utils/debug';

  // Accept SSR auth data to avoid unnecessary GraphQL calls
  export let ssrAuth: {
    isLoggedIn: boolean;
    hasAuthToken: boolean;
    hasRefreshToken: boolean;
    authTokenExpiresAt: number | null;
  } | undefined = undefined;

  let currentLoggedInState: any = { isLoggedIn: false, isAuthInitialized: false };

  onMount(async () => {
    try {
      // Initialize preferences store
      preferencesStore.init();

      // Expose auth stores globally for error toast functionality
      if (typeof window !== 'undefined') {
        const win = window as typeof window & {
          loggedInStore?: typeof loggedInStore;
          loginModalStore?: typeof loginModalStore;
          loggedInStoreValue?: unknown;
        };
        win.loggedInStore = loggedInStore;
        win.loginModalStore = loginModalStore;

        // Subscribe to store changes and keep current value available
        loggedInStore.subscribe((state) => {
          currentLoggedInState = state;
          win.loggedInStoreValue = state;
        });
      }
      // If we have SSR auth data, use it instead of making GraphQL calls
      if (ssrAuth) {
        debug.auth("Using SSR auth data - skipping GraphQL user query");

        if (ssrAuth.isLoggedIn && ssrAuth.hasAuthToken) {
          debug.success("SSR data shows user is logged in");

          // Fetch user data for PostHog identification
          try {
            const queriesModule = await import('../../services/queries');
            // Type-level cast only: 'getUserQuery' is not exported by this module,
            // so it is undefined at runtime and the call below throws into the
            // catch fallback (existing behavior, intentionally preserved).
            const { getUserQuery } = queriesModule as typeof queriesModule & {
              getUserQuery: typeof queriesModule.getUser;
            };
            const queryConfig = getUserQuery();
            const userData = await queryConfig.queryFn();

            loggedInStore.setLoggedIn({
              id: userData.id,
              username: userData.username,
              email: userData.email ?? undefined
            });
          } catch (error) {
            debug.warn("Failed to fetch user data for analytics:", error);
            // Still set logged in, just without PostHog identification
            loggedInStore.setLoggedIn();
          }

          // Start token refresher if we have refresh capabilities; the
          // server passes the token expiry, never the token itself
          if (ssrAuth.hasRefreshToken && ssrAuth.authTokenExpiresAt) {
            TokenRefresher.getInstance(async () => {
              return refreshTokenSimple();
            }).startWithExpiry(ssrAuth.authTokenExpiresAt);
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

      // Subscribe to the query result.
      // NOTE: async onMount callbacks cannot register cleanup functions
      // (Svelte ignores the promise-resolved value), so no unsubscribe is
      // returned here — matching the previous runtime behavior.
      userQuery.subscribe((result) => {
        if (result.isSuccess && result.data) {
          debug.success("User details fetched successfully - user is logged in");
          loggedInStore.setLoggedIn({
            id: result.data.id,
            username: result.data.username,
            email: result.data.email ?? undefined
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
    } catch (error) {
      debug.error("Auth initialization failed:", error);
      loggedInStore.logout();
      loggedInStore.setAuthInitialized();
    }
  });
</script>

<!-- This component doesn't render anything, it just initializes auth state -->