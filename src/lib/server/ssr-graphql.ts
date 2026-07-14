import { GraphQLClient } from 'graphql-request';

// Shared SSR GraphQL helpers, extracted from the per-page copies in the
// old .astro frontmatter

export function createSSRGraphQLClient(graphqlHost: string, cookieHeader: string | null) {
  return new GraphQLClient(graphqlHost, {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      return fetch(input, {
        ...init,
        credentials: 'include',
        headers: {
          ...init?.headers,
          ...(cookieHeader && { Cookie: cookieHeader })
        }
      });
    }
  });
}

export function isAuthError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  const response = error?.response;

  if (response?.errors && Array.isArray(response.errors)) {
    const hasAuthError = response.errors.some((err: any) => {
      const msg = (err.message || '').toLowerCase();
      return msg.includes('access denied') ||
             msg.includes('unauthorized') ||
             msg.includes('invalid token') ||
             msg.includes('jwt') ||
             msg.includes('authentication') ||
             msg.includes('forbidden') ||
             msg.includes('expired');
    });
    if (hasAuthError) return true;
  }

  return message.includes('access denied') ||
         message.includes('unauthorized') ||
         message.includes('invalid token') ||
         message.includes('jwt') ||
         message.includes('authentication') ||
         message.includes('forbidden') ||
         message.includes('expired');
}

export interface SSRFetcher {
  fetchWithFallback: (query: any, variables: any, description: string) => Promise<any>;
  wasTokenExpired: () => boolean;
}

// Fetch with a timeout; on auth errors retry once without credentials so
// public data still renders, and remember that the token was bad
export function makeSSRFetcher(graphqlHost: string, cookieHeader: string | null): SSRFetcher {
  const client = createSSRGraphQLClient(graphqlHost, cookieHeader);
  let tokenExpired = false;

  async function fetchWithFallback(query: any, variables: any, description: string) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      return await Promise.race([client.request(query, variables), timeoutPromise]);
    } catch (error) {
      console.error(`[SSR] Failed to fetch ${description}:`, error);

      if (isAuthError(error)) {
        console.warn(`[SSR] Auth error detected for ${description} - token may be expired`);
        tokenExpired = true;
        try {
          const publicClient = createSSRGraphQLClient(graphqlHost, null);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Public request timeout')), 8000)
          );
          return await Promise.race([publicClient.request(query, variables), timeoutPromise]);
        } catch (publicError) {
          console.error(`[SSR] Failed to fetch ${description} without auth:`, publicError);
          return null;
        }
      }
      return null;
    }
  }

  return { fetchWithFallback, wasTokenExpired: () => tokenExpired };
}

// Pages that detect an expired token during SSR blank out the auth state
// they return to the client
export function loggedOutAuth() {
  return {
    isLoggedIn: false,
    authToken: undefined,
    refreshToken: undefined,
    hasAuthToken: false,
    hasRefreshToken: false
  };
}

export function getCurrentSeason(): string {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  if (month >= 0 && month <= 2) return `WINTER_${year}`;
  if (month >= 3 && month <= 5) return `SPRING_${year}`;
  if (month >= 6 && month <= 8) return `SUMMER_${year}`;
  return `FALL_${year}`;
}
