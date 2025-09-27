import { QueryClient } from '@tanstack/svelte-query';

// Create a query client with SSR-safe configuration
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Optimized settings to reduce re-requests
        retry: 0, // No retries to avoid surprise re-requests
        refetchOnWindowFocus: false, // Don't refetch when user returns to tab
        refetchOnReconnect: false, // Don't refetch on network reconnect
        staleTime: 30_000, // 30 seconds - data stays fresh longer
        gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
        refetchOnMount: true, // Still refetch on component mount for fresh data
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
    // Warm up GraphQL connection on client-side initialization
    warmupGraphQLConnection();
  }

  return queryClient;
}

// GraphQL connection warm-up utility
async function warmupGraphQLConnection(): Promise<void> {
  // Only run on client-side
  if (typeof window === 'undefined') return;

  try {
    // Get the GraphQL endpoint from config (will be determined at runtime)
    const isProduction = window.location.hostname === 'weeb.vip';
    const graphqlEndpoint = isProduction
      ? 'https://gateway.weeb.vip/graphql'
      : 'https://gateway.staging.weeb.vip/graphql';

    // Fire-and-forget warm-up to keep socket/TLS connection hot
    fetch(graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{__typename}'
      }),
      keepalive: true,
    }).catch(() => {
      // Silently ignore errors - this is just a warm-up
    });
  } catch (error) {
    // Silently ignore any errors during warm-up
  }
}

// Export warm-up function for manual triggering (e.g., on route changes)
export { warmupGraphQLConnection };