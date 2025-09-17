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

      // Store tokens
      AuthStorage.setTokens(signinResult.Credentials.token, signinResult.Credentials.refresh_token);

      // Start token refresher
      TokenRefresher.getInstance(refreshTokenSimple).start(signinResult.Credentials.token);

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