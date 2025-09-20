import { createQuery, createMutation, createInfiniteQuery } from '@tanstack/svelte-query';
import type {
  LoginInput,
  SigninResult,
  RegisterInput,
  User,
  GetHomePageDataQuery,
  CurrentlyAiringQuery,
  GetAnimeDetailsByIdQuery,
  UserAnimesQuery,
  UserAnimesQueryVariables,
  RequestPasswordResetInput,
  ResetPasswordInput,
  UpdateUserInput,
  UserAnimeInput
} from "../../gql/graphql";
import {
  login as loginQuery,
  register as registerQuery,
  getUser as getUserQuery,
  fetchHomePageData as homePageDataQuery,
  fetchCurrentlyAiring as currentlyAiringQuery,
  fetchDetails as detailsQuery,
  fetchUserAnimes as userAnimesQuery,
  requestPasswordReset as passwordResetRequestQuery,
  resetPassword as passwordResetQuery,
  verifyEmail as verifyEmailQuery,
  resendVerificationEmail as resendVerificationQuery,
  updateUserDetails as updateUserDetailsQuery,
  upsertAnime as upsertAnimeQuery,
  deleteAnime as deleteAnimeQuery,
  refreshTokenSimple
} from "../../services/queries";
import { initializeQueryClient } from './query-client';
import debug from "../../utils/debug";
import { loggedInStore } from '../stores/auth';
import { TokenRefresher } from "../../services/token_refresher";
import { AuthStorage } from "../../utils/auth-storage";

// Initialize query client for Svelte
const queryClient = initializeQueryClient();

// Query key factory for better organization and cache invalidation
export const queryKeys = {
  all: ['svelte'] as const,
  users: () => [...queryKeys.all, 'users'] as const,
  user: () => [...queryKeys.users(), 'user'] as const,
  anime: () => [...queryKeys.all, 'anime'] as const,
  animeDetail: (id: string) => [...queryKeys.anime(), 'detail', id] as const,
  homePageData: () => [...queryKeys.all, 'homePageData'] as const,
  currentlyAiring: () => [...queryKeys.all, 'currentlyAiring'] as const,
  userAnimes: (variables: UserAnimesQueryVariables) =>
    [...queryKeys.users(), 'animes', variables] as const,
};

// ============================================================================
// AUTH QUERIES & MUTATIONS
// ============================================================================

export function useLogin() {
  return createMutation({
    mutationFn: async (input: LoginInput): Promise<SigninResult> => {
      debug.auth("Starting Svelte login mutation");

      // Use the existing React query structure
      const queryConfig = loginQuery();
      const response = await queryConfig.mutationFn({ input });

      return response;
    },
    onSuccess: (data: SigninResult) => {
      debug.auth("Svelte login successful");

      // Server sets HttpOnly cookies automatically
      console.log("✅ Svelte login successful - server set cookies");

      // Update auth store
      loggedInStore.setLoggedIn();

      // Start token refresher
      TokenRefresher.getInstance(async () => {
        return refreshTokenSimple();
      }).start(data.Credentials.token);

      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: queryKeys.user() });
    },
    onError: (error: any) => {
      debug.error("Svelte login failed:", error);
    },
  });
}

export function useRegister() {
  return createMutation({
    mutationFn: async (input: LoginInput) => {
      debug.auth("Starting Svelte registration");

      const queryConfig = registerQuery();
      const response = await queryConfig.mutationFn({ input });

      return response;
    },
    onSuccess: (data: any) => {
      debug.success("Svelte registration successful");
    },
    onError: (error: any) => {
      debug.error("Svelte registration failed:", error);
    },
  });
}

export function usePasswordReset() {
  return createMutation({
    mutationFn: async (input: RequestPasswordResetInput) => {
      const queryConfig = passwordResetRequestQuery();
      return queryConfig.mutationFn({ input });
    },
  });
}

export function usePasswordResetConfirm() {
  return createMutation({
    mutationFn: async (input: ResetPasswordInput) => {
      const queryConfig = passwordResetQuery();
      return queryConfig.mutationFn({ input });
    },
  });
}

export function useVerifyEmail() {
  return createMutation({
    mutationFn: async (token: string) => {
      const queryConfig = verifyEmailQuery(token);
      return queryConfig.mutationFn();
    },
  });
}

export function useResendVerificationEmail() {
  return createMutation({
    mutationFn: async (input: { username: string }): Promise<boolean> => {
      const queryConfig = resendVerificationQuery();
      return queryConfig.mutationFn(input);
    },
  });
}

// ============================================================================
// USER QUERIES & MUTATIONS
// ============================================================================

export function useUser() {
  return createQuery({
    queryKey: queryKeys.user(),
    queryFn: async (): Promise<User> => {
      const queryConfig = getUserQuery();
      return queryConfig.queryFn();
    },
    enabled: true, // Can be made conditional based on auth state
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 401/403
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useUpdateUser() {
  return createMutation({
    mutationFn: async (input: UpdateUserInput) => {
      const queryConfig = updateUserDetailsQuery();
      return queryConfig.mutationFn({ input });
    },
    onSuccess: () => {
      // Invalidate user queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: queryKeys.user() });
    },
  });
}

export function useUserAnimes(variables: UserAnimesQueryVariables) {
  return createQuery({
    queryKey: queryKeys.userAnimes(variables),
    queryFn: async (): Promise<UserAnimesQuery> => {
      const queryConfig = userAnimesQuery(variables);
      return queryConfig.queryFn();
    },
    enabled: !!variables, // Only run if variables provided
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// ============================================================================
// ANIME QUERIES & MUTATIONS
// ============================================================================

export function useHomePageData() {
  return createQuery({
    queryKey: queryKeys.homePageData(),
    queryFn: async (): Promise<GetHomePageDataQuery> => {
      const queryConfig = homePageDataQuery();
      return queryConfig.queryFn();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useCurrentlyAiring() {
  return createQuery({
    queryKey: queryKeys.currentlyAiring(),
    queryFn: async (): Promise<CurrentlyAiringQuery> => {
      const queryConfig = currentlyAiringQuery();
      return queryConfig.queryFn();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAnimeDetails(id: string) {
  return createQuery({
    queryKey: queryKeys.animeDetail(id),
    queryFn: async (): Promise<GetAnimeDetailsByIdQuery> => {
      const queryConfig = detailsQuery(id);
      return queryConfig.queryFn();
    },
    enabled: !!id, // Only run if ID provided
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
}

export function useUpsertAnime() {
  return createMutation({
    mutationFn: async (input: UserAnimeInput) => {
      const queryConfig = upsertAnimeQuery();
      return queryConfig.mutationFn({ input });
    },
    onSuccess: () => {
      // Invalidate user anime queries to show updated data
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });
}

export function useDeleteAnime() {
  return createMutation({
    mutationFn: async (animeId: string) => {
      const queryConfig = deleteAnimeQuery();
      return queryConfig.mutationFn({ animeId });
    },
    onSuccess: () => {
      // Invalidate user anime queries
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Helper to clear auth-related queries on logout
export function clearAuthQueries() {
  queryClient.removeQueries({ queryKey: queryKeys.users() });
  queryClient.removeQueries({ queryKey: ['login'] });
  queryClient.removeQueries({ queryKey: ['register'] });
}

// Helper to prefetch common data
export function prefetchHomeData() {
  return queryClient.prefetchQuery({
    queryKey: queryKeys.homePageData(),
    queryFn: async () => {
      const queryConfig = homePageDataQuery();
      return queryConfig.queryFn();
    },
    staleTime: 10 * 60 * 1000,
  });
}

// Export the query client for direct access if needed
export { queryClient };