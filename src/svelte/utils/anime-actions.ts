import { createMutation } from '@tanstack/svelte-query';
import type { UserAnimeInput } from "../../gql/graphql";
import { queryClient, queryKeys } from '../services/queries';
import { upsertAnime as upsertAnimeQuery, deleteAnime as deleteAnimeQuery } from "../../services/queries";

/**
 * Enhanced anime mutations with consistent toast error handling
 * Use these instead of the raw mutations to get automatic error toasts with login options
 */

export function useAddAnimeWithToast() {
  return createMutation({
    mutationFn: async (variables: { input: UserAnimeInput }) => {
      const queryConfig = upsertAnimeQuery();
      return queryConfig.mutationFn(variables);
    },
    onSuccess: (data, variables) => {
      console.log('🎯 Add anime success - invalidating queries for anime:', variables.input.animeID);

      // Invalidate all relevant queries using proper query keys
      queryClient.invalidateQueries({ queryKey: queryKeys.users() }); // All user-related data
      queryClient.invalidateQueries({ queryKey: queryKeys.currentlyAiring() }); // Currently airing
      queryClient.invalidateQueries({ queryKey: queryKeys.homePageData() }); // Homepage data
      queryClient.invalidateQueries({ queryKey: queryKeys.anime() }); // All anime-related data (includes details)
      queryClient.invalidateQueries({ queryKey: ['homedata'] }); // Legacy key - partial match
      queryClient.invalidateQueries({ queryKey: ['currently-airing'] }); // Legacy key
      queryClient.invalidateQueries({ queryKey: ['seasonal-anime'] }); // Seasonal data - partial match

      // Invalidate all queries with parameters that match homepage queries
      // But exclude calendar-specific queries with date parameters
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          const match = key === 'homedata' || key === 'seasonal-anime' || key === 'currently-airing';

          // Exclude calendar queries that have specific date parameters
          const isCalendarQuery = key === 'currentlyAiringWithEpisodes' &&
            query.queryKey[1] &&
            typeof query.queryKey[1] === 'object' &&
            'startDate' in query.queryKey[1];

          const shouldInvalidate = match && !isCalendarQuery;
          if (shouldInvalidate) {
            console.log('🔄 Invalidating query with key:', query.queryKey);
          } else if (isCalendarQuery) {
            console.log('🗓️ Skipping calendar query:', query.queryKey);
          }
          return shouldInvalidate;
        }
      });
      queryClient.invalidateQueries({ queryKey: ['user-animes'] }); // User anime lists
      queryClient.invalidateQueries({ queryKey: ['anime-details'] }); // Anime details (legacy)

      // Force refetch critical queries for immediate UI update
      // Exclude calendar queries from refetch to prevent date range corruption
      queryClient.refetchQueries({ queryKey: queryKeys.currentlyAiring() });
      queryClient.refetchQueries({ queryKey: ['currently-airing'] }); // Legacy key
      queryClient.refetchQueries({ queryKey: ['homedata'] }); // Legacy key - partial match
      queryClient.refetchQueries({ type: 'all', predicate: (query) => {
        // Refetch all queries that start with 'homedata' or 'seasonal-anime'
        // But exclude calendar queries with date parameters
        const key = query.queryKey[0];
        const match = key === 'homedata' || key === 'seasonal-anime';

        // Exclude calendar queries that have specific date parameters
        const isCalendarQuery = key === 'currentlyAiringWithEpisodes' &&
          query.queryKey[1] &&
          typeof query.queryKey[1] === 'object' &&
          'startDate' in query.queryKey[1];

        const shouldRefetch = match && !isCalendarQuery;
        if (isCalendarQuery) {
          console.log('🗓️ Skipping calendar refetch:', query.queryKey);
        }
        return shouldRefetch;
      }});

      // Show success toast if available
      if (typeof window !== 'undefined' && window.toast) {
        window.toast.success('Added to your list!');
      }
    },
    onError: (error, variables) => {
      console.error('❌ Add anime mutation failed:', error);

      // Show error toast with auth-aware login button
      if (typeof window !== 'undefined' && window.showErrorToast) {
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

        window.showErrorToast(message, isAuthError);
      }
    }
  }, queryClient);
}

export function useDeleteAnimeWithToast() {
  return createMutation({
    mutationFn: async (animeId: string) => {
      const queryConfig = deleteAnimeQuery();
      return queryConfig.mutationFn(animeId);
    },
    onSuccess: (data, animeId) => {
      // Invalidate all relevant queries using proper query keys
      queryClient.invalidateQueries({ queryKey: queryKeys.users() }); // All user-related data
      queryClient.invalidateQueries({ queryKey: queryKeys.currentlyAiring() }); // Currently airing
      queryClient.invalidateQueries({ queryKey: queryKeys.homePageData() }); // Homepage data
      queryClient.invalidateQueries({ queryKey: queryKeys.anime() }); // All anime-related data (includes details)
      queryClient.invalidateQueries({ queryKey: ['homedata'] }); // Legacy key - partial match
      queryClient.invalidateQueries({ queryKey: ['currently-airing'] }); // Legacy key
      queryClient.invalidateQueries({ queryKey: ['seasonal-anime'] }); // Seasonal data - partial match

      // Invalidate all queries with parameters that match homepage queries
      // But exclude calendar-specific queries with date parameters
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          const match = key === 'homedata' || key === 'seasonal-anime' || key === 'currently-airing';

          // Exclude calendar queries that have specific date parameters
          const isCalendarQuery = key === 'currentlyAiringWithEpisodes' &&
            query.queryKey[1] &&
            typeof query.queryKey[1] === 'object' &&
            'startDate' in query.queryKey[1];

          const shouldInvalidate = match && !isCalendarQuery;
          if (shouldInvalidate) {
            console.log('🔄 Invalidating query with key:', query.queryKey);
          } else if (isCalendarQuery) {
            console.log('🗓️ Skipping calendar query:', query.queryKey);
          }
          return shouldInvalidate;
        }
      });
      queryClient.invalidateQueries({ queryKey: ['user-animes'] }); // User anime lists
      queryClient.invalidateQueries({ queryKey: ['anime-details'] }); // Anime details (legacy)

      // Force refetch critical queries for immediate UI update
      // Exclude calendar queries from refetch to prevent date range corruption
      queryClient.refetchQueries({ queryKey: queryKeys.currentlyAiring() });
      queryClient.refetchQueries({ queryKey: ['currently-airing'] }); // Legacy key
      queryClient.refetchQueries({ queryKey: ['homedata'] }); // Legacy key - partial match
      queryClient.refetchQueries({ type: 'all', predicate: (query) => {
        // Refetch all queries that start with 'homedata' or 'seasonal-anime'
        // But exclude calendar queries with date parameters
        const key = query.queryKey[0];
        const match = key === 'homedata' || key === 'seasonal-anime';

        // Exclude calendar queries that have specific date parameters
        const isCalendarQuery = key === 'currentlyAiringWithEpisodes' &&
          query.queryKey[1] &&
          typeof query.queryKey[1] === 'object' &&
          'startDate' in query.queryKey[1];

        const shouldRefetch = match && !isCalendarQuery;
        if (isCalendarQuery) {
          console.log('🗓️ Skipping calendar refetch:', query.queryKey);
        }
        return shouldRefetch;
      }});

      // Show success toast if available
      if (typeof window !== 'undefined' && window.toast) {
        window.toast.success('Removed from your list!');
      }
    },
    onError: (error, animeId) => {
      console.error('❌ Delete anime mutation failed:', error);

      // Show error toast with auth-aware login button
      if (typeof window !== 'undefined' && window.showErrorToast) {
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

        window.showErrorToast(message, isAuthError);
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
      });
    },
    addToWatching: (animeId: string) => {
      return addMutation.mutate({
        input: {
          animeID: animeId,
          status: 'WATCHING'
        }
      });
    },
    addToCompleted: (animeId: string) => {
      return addMutation.mutate({
        input: {
          animeID: animeId,
          status: 'COMPLETED'
        }
      });
    },
    isLoading: addMutation.isPending
  };
}