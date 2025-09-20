<script lang="ts">
  import { onMount } from 'svelte';
  import { loggedInStore } from '../stores/auth';
  import { AuthStorage } from '../../utils/auth-storage';
  import { TokenRefresher } from '../../services/token_refresher';
  import { refreshTokenSimple } from '../../services/queries';
  import debug from '../../utils/debug';

  onMount(async () => {
    try {
      debug.auth("Initializing Svelte auth state");

      // Check cookie-based login status
      const isLoggedInFromCookies = loggedInStore.checkCookieStatus();

      debug.auth("Cookie-based login check:", {
        isLoggedIn: isLoggedInFromCookies
      });

      if (isLoggedInFromCookies) {
        // Get tokens for refresh logic
        const authToken = AuthStorage.getAuthToken();
        const refreshToken = AuthStorage.getRefreshToken();
        // If we have a refresh token, try to refresh
        if (refreshToken) {
          try {
            debug.auth("Attempting to refresh token");
            const result = await refreshTokenSimple();

            if (result?.Credentials) {
              debug.success("Token refreshed successfully");
              loggedInStore.setLoggedIn();

              // Start token refresher with the new token
              TokenRefresher.getInstance(async () => {
                return refreshTokenSimple();
              }).start(result.Credentials.token);
            }
          } catch (error: any) {
            debug.error("Token validation/refresh failed:", error.message);

            // Only clear tokens if it's an auth error
            const isAuthError = error.message?.toLowerCase().includes('unauthorized') ||
                               error.message?.toLowerCase().includes('invalid') ||
                               error.message?.toLowerCase().includes('expired') ||
                               error.message?.toLowerCase().includes('forbidden');

            if (isAuthError) {
              debug.auth("Authentication failed, clearing tokens");
              AuthStorage.clearTokens();
              loggedInStore.logout();
            } else {
              debug.warn("Network or temporary error, keeping tokens for retry");
              // Still set as logged in if we have auth token
              if (authToken) {
                loggedInStore.setLoggedIn();
              }
            }
          }
        } else if (authToken) {
          // Only auth token, no refresh token
          debug.warn("Auth token found but no refresh token");
          loggedInStore.setLoggedIn();
        }
      } else {
        debug.auth("No tokens found, user not logged in");
      }
    } catch (error) {
      debug.error("Auth initialization failed:", error);
      // In case of error, ensure auth is marked as initialized
      loggedInStore.setAuthInitialized();
    }
  });
</script>

<!-- This component doesn't render anything, it just initializes auth state -->