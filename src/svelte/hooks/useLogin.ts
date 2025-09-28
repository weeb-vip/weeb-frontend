import { writable } from 'svelte/store';
import type { LoginInput, SigninResult } from "../../gql/graphql";
import { refreshTokenSimple, queryClient, queryKeys } from "../../services/queries";
import { mutationCreateSession } from "../../services/api/graphql/queries";
import { TokenRefresher } from "../../services/token_refresher";
import { AuthStorage } from "../../utils/auth-storage";
import { loggedInStore } from "../stores/auth";
import debug from "../../utils/debug";

interface LoginState {
  isLoading: boolean;
  error: string | null;
  success: boolean;
}

export function useLogin() {
  const state = writable<LoginState>({
    isLoading: false,
    error: null,
    success: false
  });

  const mutateLogin = async (input: LoginInput, onSuccess?: () => void) => {
    state.update(s => ({ ...s, isLoading: true, error: null, success: false }));

    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: mutationCreateSession,
          variables: { input }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Login failed');
      }

      const signinResult: SigninResult = result.data.signin;

      // Server sets HttpOnly cookies automatically - no manual storage needed
      console.log("✅ Login successful - server set cookies automatically");

      // 🏠 For localhost development: manually set cookies since server might not
      if (signinResult.Credentials?.token) {
        AuthStorage.setTokensForLocalhost(
          signinResult.Credentials.token,
          signinResult.Credentials.refresh_token || undefined
        );
      }

      // Store refresh token in localStorage as fallback (server sets HttpOnly cookies)
      if (signinResult.Credentials?.refresh_token) {
        AuthStorage.setRefreshTokenLocalStorage(signinResult.Credentials.refresh_token);
        debug.auth('Refresh token stored in localStorage during login');
      } else {
        debug.warn('No refresh token received in login response');
      }

      // Start token refresher (will read tokens from cookies)
      const authToken = AuthStorage.getAuthToken();
      if (authToken) {
        TokenRefresher.getInstance(refreshTokenSimple).start(authToken);
      } else {
        debug.warn("No auth token found in cookies after login");
      }

      // Update auth store with user data if available
      if (signinResult.user) {
        loggedInStore.setLoggedIn({
          id: signinResult.user.id,
          username: signinResult.user.username,
          email: signinResult.user.email
        });
        debug.auth('Auth store updated with user data after login');
      } else {
        // Fallback: just set logged in status
        loggedInStore.setLoggedIn();
        debug.auth('Auth store updated (no user data available)');
      }

      // Invalidate all user-related queries to refresh data
      try {
        queryClient.invalidateQueries({ queryKey: queryKeys.user() });
        queryClient.invalidateQueries({ queryKey: queryKeys.users() });
        queryClient.invalidateQueries({ queryKey: ['user'] }); // Legacy key
        queryClient.invalidateQueries({ queryKey: ['user-animes'] }); // User anime lists
        debug.success('User queries invalidated after login');
      } catch (error) {
        debug.error('Failed to invalidate queries after login:', error);
      }

      state.update(s => ({ ...s, isLoading: false, success: true }));

      if (onSuccess) {
        onSuccess();
      }

    } catch (error: any) {
      debug.warn("Login failed. Please check your credentials.");
      state.update(s => ({
        ...s,
        isLoading: false,
        error: "Login failed. Please check your credentials and try again."
      }));
    }
  };

  return {
    state,
    mutateLogin
  };
}