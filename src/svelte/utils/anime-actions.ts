import { createMutation } from '@tanstack/svelte-query';
import { toast } from 'svelte-sonner';
import type { UserAnimeInput } from "../../gql/graphql";
import { initializeQueryClient } from '../services/query-client';
import { upsertAnime as upsertAnimeQuery, deleteAnime as deleteAnimeQuery } from "../../services/queries";

/**
 * Enhanced anime mutations with consistent toast error handling
 * Use these instead of the raw mutations to get automatic error toasts with login options
 */

export function useAddAnimeWithToast() {
  const queryClient = initializeQueryClient();

  return createMutation({
    mutationFn: async (variables: { input: UserAnimeInput }) => {
      const queryConfig = upsertAnimeQuery();
      return queryConfig.mutationFn(variables);
    },
    onSuccess: (data, variables) => {
      console.log('🎯 Add anime success - invalidating queries for anime:', variables.input.animeID);

      // Invalidate all relevant queries using query client from context
      queryClient.invalidateQueries();
    },
    onError: (error, variables) => {
      console.error('❌ Add anime mutation failed:', error);

      // Show error toast with auth-aware login button
      let message = 'Failed to add anime to list';
      let isAuthError = false;

      // Extract specific error messages
      if (error?.message) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('unauthorized') || errorMsg.includes('forbidden') || errorMsg.includes('access denied') || errorMsg.includes('authentication') || errorMsg.includes('not authenticated') || errorMsg.includes('not logged in') || errorMsg.includes('login required')) {
          message = 'Please log in to add anime to your list';
          isAuthError = true;
        } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
          message = 'Network error. Please try again';
        } else if (errorMsg.includes('missing input value') || errorMsg.includes('animeID')) {
          message = 'Invalid anime data. Please try again.';
        } else if (error.message.length < 80) {
          message = error.message;
        }
      }

      if (isAuthError && typeof window !== 'undefined') {
        // Check if user is actually logged out
        const isUserLoggedIn = window.loggedInStoreValue?.isLoggedIn || false;

        if (!isUserLoggedIn) {
          // Show error toast with Login action
          toast.error(message, {
            action: {
              label: 'Login',
              onClick: () => {
                if (window.loginModalStore) {
                  window.loginModalStore.openLogin();
                }
              }
            },
            duration: 8000
          }, queryClient);
        } else {
          // User is logged in but still got auth error, show generic error
          toast.error('Authentication error. Please try again.');
        }
      } else {
        // Show regular error toast
        toast.error(message);
      }
    }
  }, queryClient);
}

export function useDeleteAnimeWithToast() {
  const queryClient = initializeQueryClient();

  return createMutation({
    mutationFn: async (animeId: string) => {
      const queryConfig = deleteAnimeQuery();
      return queryConfig.mutationFn(animeId);
    },
    onSuccess: (data, animeId) => {
      console.log('🗑️ Delete anime success - invalidating queries for anime:', animeId);

      // Invalidate all relevant queries using query client from context
      queryClient.invalidateQueries();
    },
    onError: (error, animeId) => {
      console.error('❌ Delete anime mutation failed:', error);

      // Show error toast with auth-aware login button
      let message = 'Failed to remove anime from list';
      let isAuthError = false;

      // Extract specific error messages
      if (error?.message) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('unauthorized') || errorMsg.includes('forbidden') || errorMsg.includes('access denied') || errorMsg.includes('authentication') || errorMsg.includes('not authenticated') || errorMsg.includes('not logged in') || errorMsg.includes('login required')) {
          message = 'Please log in to manage your list';
          isAuthError = true;
        } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
          message = 'Network error. Please try again';
        } else if (errorMsg.includes('missing input value') || errorMsg.includes('animeID')) {
          message = 'Invalid anime data. Please try again.';
        } else if (error.message.length < 80) {
          message = error.message;
        }
      }

      if (isAuthError && typeof window !== 'undefined') {
        // Check if user is actually logged out
        const isUserLoggedIn = window.loggedInStoreValue?.isLoggedIn || false;

        if (!isUserLoggedIn) {
          // Show error toast with Login action
          toast.error(message, {
            action: {
              label: 'Login',
              onClick: () => {
                if (window.loginModalStore) {
                  window.loginModalStore.openLogin();
                }
              }
            },
            duration: 8000
          }, queryClient);
        } else {
          // User is logged in but still got auth error, show generic error
          toast.error('Authentication error. Please try again.');
        }
      } else {
        // Show regular error toast
        toast.error(message);
      }
    }
  }, queryClient);
}

/**
 * Helper function to quickly add anime to "Plan to Watch" list
 */
export function useQuickAddAnime() {
  const addMutation = useAddAnimeWithToast();

  return {
    addToPlanToWatch: (animeId: string) => {
      return addMutation.mutate({
        input: {
          animeID: animeId,
          status: 'PLAN_TO_WATCH'
        }
      }, queryClient);
    },
    addToWatching: (animeId: string) => {
      return addMutation.mutate({
        input: {
          animeID: animeId,
          status: 'WATCHING'
        }
      }, queryClient);
    },
    addToCompleted: (animeId: string) => {
      return addMutation.mutate({
        input: {
          animeID: animeId,
          status: 'COMPLETED'
        }
      }, queryClient);
    },
    isLoading: addMutation.isPending
  };
}
