import { QueryClient } from '@tanstack/svelte-query';

// Create a query client with SSR-safe configuration
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // SSR-safe defaults
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors
          if (error instanceof Error && 'status' in error) {
            const status = (error as any).status;
            if (status >= 400 && status < 500) return false;
          }
          return failureCount < 3;
        },
        // Don't refetch on window focus during SSR
        refetchOnWindowFocus: false,
        refetchOnMount: true,
        // Add networkMode to ensure credentials are included
        networkMode: 'online',
      },
      mutations: {
        retry: false,
        // Add networkMode for mutations too
        networkMode: 'online',
      },
    },
  });
}

// Global query client instance
let queryClient: QueryClient;

export function getQueryClient(): QueryClient {
  if (!queryClient) {
    queryClient = createQueryClient();
  }
  return queryClient;
}

// SSR-safe initialization
export function initializeQueryClient(): QueryClient {
  // Create a new client for each SSR request to avoid state leakage
  if (typeof window === 'undefined') {
    return createQueryClient();
  }

  // Reuse client on client-side
  if (!queryClient) {
    queryClient = createQueryClient();
  }

  return queryClient;
}