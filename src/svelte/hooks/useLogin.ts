import { writable } from 'svelte/store';
import type { LoginInput, SigninResult } from "../../gql/graphql";
import { login, refreshTokenSimple } from "../../services/queries";
import { TokenRefresher } from "../../services/token_refresher";
import { AuthStorage } from "../../utils/auth-storage";
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
          query: login().query,
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

      // Start token refresher (will read tokens from cookies)
      const authToken = AuthStorage.getAuthToken();
      if (authToken) {
        TokenRefresher.getInstance(refreshTokenSimple).start(authToken);
      } else {
        debug.warn("No auth token found in cookies after login");
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