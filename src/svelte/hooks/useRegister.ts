import { writable } from 'svelte/store';
import type { LoginInput } from "../../gql/graphql";
import { register } from "../../services/queries";
import debug from "../../utils/debug";

interface RegisterState {
  isLoading: boolean;
  error: string | null;
  success: boolean;
}

export function useRegister() {
  const state = writable<RegisterState>({
    isLoading: false,
    error: null,
    success: false
  });

  const mutateRegister = async (input: LoginInput, onSuccess?: (response: any) => void) => {
    state.update(s => ({ ...s, isLoading: true, error: null, success: false }));

    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: register().query,
          variables: { input }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Registration failed');
      }

      debug.success("Registration successful!", result.data);
      state.update(s => ({ ...s, isLoading: false, success: true }));

      if (onSuccess) {
        onSuccess(result.data);
      }

    } catch (error: any) {
      debug.warn("Registration failed");
      state.update(s => ({
        ...s,
        isLoading: false,
        error: "Registration failed. Please try again or choose a different username."
      }));
    }
  };

  return {
    state,
    mutateRegister
  };
}