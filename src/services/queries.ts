import api from "./api";
import {type searchResults} from "./api/search";
import request, {GraphQLClient} from "graphql-request";
import debug from "../utils/debug";
import {AuthStorage} from "../utils/auth-storage";

import { ensureConfigLoaded } from './config-loader';

// Config accessor that dynamically ensures config is loaded
async function getConfig() {
  return await ensureConfigLoaded();
}
import {
  type CurrentlyAiringQuery,
  type GetAnimeDetailsByIdQuery,
  type GetHomePageDataQuery,
  type LoginInput,
  type RefreshTokenMutation,
  type RegisterInput,
  type RegisterResult,
  type RequestPasswordResetInput,
  type ResetPasswordInput,
  type SigninResult,
  type UpdateUserInput,
  type User,
  type UserAnimeInput,
  type UserAnimesQuery,
  type UserAnimesQueryVariables
} from "../gql/graphql";
import {
  getAnimeDetailsByID,
  getCurrentlyAiring, getCurrentlyAiringWithDates, getCurrentlyAiringWithDatesAndEpisodes,
  getHomePageData, getSeasonalAnime, mutateAddAnime, mutateDeleteAnime, mutateUpdateUserDetails,
  mutationCreateSession, mutationRefreshToken, mutationRequestPasswordReset, mutationResetPassword, mutationVerifyEmail, mutationResendVerificationEmail,
  mutationRegister, mutationLogout, queryCharactersAndStaffByAnimeID, queryUserAnimes, queryUserDetails
} from "./api/graphql/queries";

;

// Helper to clear invalid tokens
const clearInvalidTokens = () => {
  debug.auth("Clearing invalid auth tokens");
  AuthStorage.clearTokens();
  // Update logged in state if available - access from window
  if (typeof window !== 'undefined' && window.localStorage) {
    const store = JSON.parse(localStorage.getItem('logged-in-store') || '{}');
    if (store?.state) {
      store.state.isLoggedIn = false;
      store.state.authInitialized = true;
      localStorage.setItem('logged-in-store', JSON.stringify(store));
    }
  }
};

// Wrapper for authenticated requests that handles auth errors
export const authenticatedRequest = async <T>(requestFn: (client: GraphQLClient) => Promise<T>): Promise<T> => {
  const client = await AuthenticatedClient();
  try {
    const result = await requestFn(client);

    // Check if the result has GraphQL errors indicating auth issues
    if (result && typeof result === 'object') {
      const response = result as any;
      if (response.errors && Array.isArray(response.errors)) {
        const hasAuthError = response.errors.some((error: any) => {
          const msg = (error.message || '').toLowerCase();
          return msg.includes('access denied') ||
                 msg.includes('unauthorized') ||
                 msg.includes('invalid token') ||
                 msg.includes('jwt') ||
                 msg.includes('authentication') ||
                 msg.includes('forbidden');
        });

        if (hasAuthError) {
          debug.auth("GraphQL auth error detected, clearing tokens");
          clearInvalidTokens();
          // Don't redirect automatically - let the component handle the error
          throw new Error('Authentication failed');
        }
      }
    }

    return result;
  } catch (error: any) {
    const message = error?.message?.toLowerCase() || '';
    const response = error?.response;

    // Check for GraphQL errors in the error response
    if (response?.errors && Array.isArray(response.errors)) {
      const hasAuthError = response.errors.some((err: any) => {
        const msg = (err.message || '').toLowerCase();
        return msg.includes('access denied') ||
               msg.includes('unauthorized') ||
               msg.includes('invalid token') ||
               msg.includes('jwt') ||
               msg.includes('authentication') ||
               msg.includes('forbidden');
      });

      if (hasAuthError) {
        debug.auth("GraphQL auth error in response, clearing tokens");
        clearInvalidTokens();
        // Don't redirect automatically - let the component handle the error
      }
    }

    // Also check for auth errors in the error message itself
    if (message.includes('access denied') ||
        message.includes('unauthorized') ||
        message.includes('invalid token') ||
        message.includes('jwt') ||
        message.includes('authentication') ||
        message.includes('forbidden')) {
      clearInvalidTokens();
      // Don't redirect automatically - let the component handle the error
    }

    throw error;
  }
};

// create authenticated client
export const AuthenticatedClient = async () => {
  const token = AuthStorage.getAuthToken();
  const config = await getConfig();

  console.log('🔧 Creating GraphQL client with token:', token ? 'Present' : 'Missing');
  console.log('🌐 GraphQL URL:', config.graphql_host);

  // @ts-ignore
  return new GraphQLClient(config.graphql_host, {
    // headers: {
    //   ...(token && { Authorization: `Bearer ${token}` })
    // },
    // For graphql-request, credentials should be passed at the top level
    credentials: 'include',
    // Alternative: use fetch options directly
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      return fetch(input, {
        ...init,
        credentials: 'include'
      });
    }
  })
}

export const fetchSearchResults = (query: string) => ({
  queryKey: ["search"],
  queryFn: () => api.search.search(query),
  select: (data: searchResults) => data,
})


export const fetchSearchAdvancedResults = (query: string, year?: number, searchlimit?: number, limit?: number) => ({
  queryKey: ["searchAdvanced", query, year],
  queryFn: () => api.search.searchAdvanced(query, year, searchlimit),
  select: (data: searchResults) => limit ? data.slice(0, limit) : data,
})

export const fetchHomePageData = () => ({
  queryKey: ['homedata', {limit: 20}],
  queryFn: async () => {
    return authenticatedRequest(async (client) => {
      // @ts-ignore
      return client.request<GetHomePageDataQuery>(getHomePageData, {
        limit: 20 // variables are typed too!
      })
    });
  },
})

export const fetchSeasonalAnime = (season: string) => ({
  queryKey: ['seasonal-anime', {season}],
  queryFn: async () => {
    return authenticatedRequest(async (client) => {
      // @ts-ignore
      return client.request(getSeasonalAnime, {
        season // variables are typed too!
      })
    });
  },
})

export const fetchDetails = (id: string) => ({
  queryKey: ["anime-details", id],
  // @ts-ignore
  queryFn: async () => {
    if (!id) throw new Error("ID is required to fetch anime details");
    return authenticatedRequest(async (client) => {
      // @ts-ignore
      return client.request<GetAnimeDetailsByIdQuery>(getAnimeDetailsByID, {
        id: id // variables are typed too!
      })
    });
  }
})

export const fetchCurrentlyAiring = (limit?: number) => ({
  queryKey: ["currently-airing", { limit }],
  queryFn: async () => {
    return authenticatedRequest(async (client) => {
      const defaultStartDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const defaultEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      // @ts-ignore
      return client.request<CurrentlyAiringQuery>(getCurrentlyAiringWithDates, {
        input: {
          startDate: defaultStartDate,
          endDate: defaultEndDate,
        },
        limit: limit || 25
      });
    });
  },
})

export const fetchCurrentlyAiringWithDates = (startDate: Date, endDate?: Date | null, days?: number, limit?: number) => ({
  queryKey: ["currentlyAiring", { startDate: startDate.toISOString(), endDate: endDate?.toISOString(), days, limit }],
  queryFn: async () => {
    const client = await AuthenticatedClient();
    // @ts-ignore
    const variables = endDate ? {
      input: {
        startDate,
        endDate,
      },
      limit: limit || 25
    } : {
      input: {
        startDate,
        daysInFuture: days,
      },
      limit: limit || 25
    };

    console.log('🔍 Sending GraphQL request with variables:', JSON.stringify(variables, null, 2));

    return client.request<CurrentlyAiringQuery>(getCurrentlyAiringWithDates, variables)
  },
})

export const fetchCurrentlyAiringWithDatesAndEpisodes = (startDate: Date, endDate?: Date | null, days?: number, limit?: number) => ({
  queryKey: ["currentlyAiringWithEpisodes", { startDate: startDate.toISOString(), endDate: endDate?.toISOString(), days, limit }],
  queryFn: async () => {
    const client = await AuthenticatedClient();
    // @ts-ignore
    return client.request<CurrentlyAiringQuery>(getCurrentlyAiringWithDatesAndEpisodes, endDate ? {
      input: {
        startDate,
        endDate,
      },
      limit: limit || 25
    } : {
      input: {
        startDate,
        daysInFuture: days,
      },
      limit: limit || 25
    })
  },
})


export const register = () => ({
  mutationFn: async (input: { input: RegisterInput }): Promise<RegisterResult> => {
    const client = await AuthenticatedClient();
    const response = await client.request(mutationRegister, input);
    return response.Register;
  }
})

export const login = () => ({
  mutationFn: async (input: { input: LoginInput }) => {
    const client = await AuthenticatedClient();
    const response = await client.request(mutationCreateSession, input);
    return response.CreateSession;
  }
})

export const requestPasswordReset = () => ({
  mutationFn: async (input: { input: RequestPasswordResetInput }): Promise<boolean> => {
    const client = await AuthenticatedClient();
    const response = await client.request(mutationRequestPasswordReset, input);
    return response.RequestPasswordReset;
  }
})

export const resetPassword = () => ({
  mutationFn: async (input: { input: ResetPasswordInput }): Promise<boolean> => {
    const client = await AuthenticatedClient();
    const response = await client.request(mutationResetPassword, input);
    return response.ResetPassword;
  }
})

export const verifyEmail = (token: string) => ({
  mutationFn: async (): Promise<boolean> => {
    const config = await getConfig();
    console.log('🌐 Verify Email GraphQL URL:', config.graphql_host);
    // @ts-ignore
    const client = new GraphQLClient(config.graphql_host, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      // For graphql-request, credentials should be passed at the top level
      credentials: 'include',
      // Alternative: use fetch options directly
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        return fetch(input, {
          ...init,
          credentials: 'include'
        });
      }
    });
    const response = await client.request(mutationVerifyEmail);
    return response.VerifyEmail;
  }
})

export const resendVerificationEmail = () => ({
  mutationFn: async (input: { username: string }): Promise<boolean> => {
    const client = await AuthenticatedClient();
    const response = await client.request(mutationResendVerificationEmail, input);
    return response.ResendVerificationEmail;
  }
})

export const logout = () => ({
  mutationFn: async (): Promise<boolean> => {
    const client = await AuthenticatedClient();
    const response = await client.request(mutationLogout);
    return response.Logout;
  }
})

// Helper to wrap existing queries with auto-refresh
export const withAutoRefresh = <T>(queryFn: () => Promise<T>) => {
  return () => executeWithAutoRefresh(queryFn);
};

// Helper to wrap SSR queries with auto-refresh
export const withAutoRefreshSSR = <T>(queryFn: (authToken?: string) => Promise<T>) => {
  return (cookieString?: string) => executeWithAutoRefreshSSR(queryFn, cookieString);
};

export const getUser = () => ({
  queryKey: ["user"],
  queryFn: async (): Promise<User> => {
    return authenticatedRequest(async (client) => {
      const response = await client.request(queryUserDetails);
      return response.UserDetails;
    });
  }
})

// Auto-retry mechanism for auth errors
export const executeWithAutoRefresh = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 1
): Promise<T> => {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const message = error?.message?.toLowerCase() || '';
      const response = error?.response;

      // Check if this is an auth error
      const isAuthError = message.includes('access denied') ||
                         message.includes('unauthorized') ||
                         message.includes('invalid token') ||
                         message.includes('jwt') ||
                         message.includes('authentication') ||
                         message.includes('forbidden') ||
                         (response?.errors && Array.isArray(response.errors) &&
                          response.errors.some((err: any) => {
                            const msg = (err.message || '').toLowerCase();
                            return msg.includes('access denied') ||
                                   msg.includes('unauthorized') ||
                                   msg.includes('invalid token') ||
                                   msg.includes('jwt') ||
                                   msg.includes('authentication') ||
                                   msg.includes('forbidden');
                          }));

      if (isAuthError && attempt < maxRetries) {
        debug.auth(`Auth error detected on attempt ${attempt + 1}, trying to refresh token`);

        try {
          // Attempt to refresh the token
          await refreshTokenSimple();
          debug.auth('Token refreshed successfully, retrying operation');

          // Continue to next iteration to retry the operation
          continue;
        } catch (refreshError) {
          debug.error('Token refresh failed during auto-retry:', refreshError);
          // If refresh fails, clear tokens and break out of retry loop
          clearInvalidTokens();
          break;
        }
      } else if (isAuthError) {
        // Auth error but no more retries left, or refresh failed
        debug.auth('Auth error with no more retries available, clearing tokens');
        clearInvalidTokens();
        break;
      } else {
        // Not an auth error, don't retry
        break;
      }
    }
  }

  // If we get here, all retries failed
  throw lastError;
};

// SSR-compatible auto-refresh for server-side operations
export const executeWithAutoRefreshSSR = async <T>(
  operation: (authToken?: string) => Promise<T>,
  cookieString?: string,
  maxRetries: number = 1
): Promise<T> => {
  let lastError: any;
  let currentAuthToken = AuthStorage.getTokenFromCookieString(cookieString);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation(currentAuthToken);
    } catch (error: any) {
      lastError = error;
      const message = error?.message?.toLowerCase() || '';
      const response = error?.response;

      // Check if this is an auth error
      const isAuthError = message.includes('access denied') ||
                         message.includes('unauthorized') ||
                         message.includes('invalid token') ||
                         message.includes('jwt') ||
                         message.includes('authentication') ||
                         message.includes('forbidden') ||
                         (response?.errors && Array.isArray(response.errors) &&
                          response.errors.some((err: any) => {
                            const msg = (err.message || '').toLowerCase();
                            return msg.includes('access denied') ||
                                   msg.includes('unauthorized') ||
                                   msg.includes('invalid token') ||
                                   msg.includes('jwt') ||
                                   msg.includes('authentication') ||
                                   msg.includes('forbidden');
                          }));

      if (isAuthError && attempt < maxRetries && cookieString) {
        debug.auth(`SSR auth error detected on attempt ${attempt + 1}, trying to refresh token`);

        try {
          // Get refresh token from cookies
          const tokens = AuthStorage.getTokensFromCookieString(cookieString);
          if (!tokens.refreshToken) {
            debug.auth('No refresh token found in SSR cookies');
            break;
          }

          // Attempt to refresh the token (SSR context)
          const config = await getConfig();
          const refreshResponse = await fetch(config.graphql_host, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': cookieString || ''
            },
            body: JSON.stringify({
              query: `
                mutation RefreshToken($token: String!) {
                  RefreshToken(token: $token) {
                    id
                    Credentials {
                      token
                      refresh_token
                    }
                  }
                }
              `,
              variables: { token: tokens.refreshToken }
            })
          });

          if (!refreshResponse.ok) {
            throw new Error(`SSR refresh failed: ${refreshResponse.status}`);
          }

          const refreshData = await refreshResponse.json();

          if (refreshData.errors) {
            throw new Error(refreshData.errors[0]?.message || 'SSR token refresh failed');
          }

          // Update current auth token for retry
          currentAuthToken = refreshData.data.RefreshToken.Credentials.token;
          debug.auth('SSR token refreshed successfully, retrying operation');

          // Continue to next iteration to retry the operation
          continue;
        } catch (refreshError) {
          debug.error('SSR token refresh failed during auto-retry:', refreshError);
          break;
        }
      } else if (isAuthError) {
        // Auth error but no more retries left, or no cookie string provided
        debug.auth('SSR auth error with no more retries available');
        break;
      } else {
        // Not an auth error, don't retry
        break;
      }
    }
  }

  // If we get here, all retries failed
  throw lastError;
};

export const refreshTokenSimple = async (): Promise<SigninResult> => {
  const refreshToken = AuthStorage.getRefreshToken();
  if (!refreshToken) {
    debug.auth("No refresh token found in storage");
    throw new Error("No refresh token available");
  }

  debug.auth("Attempting to refresh token...");

  try {
    const config = await getConfig();

    // Use fetch directly to capture response headers (graphql-request may not expose them)
    debug.auth("Making refresh token request with fetch to capture headers");

    const fetchResponse = await fetch(config.graphql_host, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation RefreshToken($token: String!) {
            RefreshToken(token: $token) {
              id
              Credentials {
                token
                refresh_token
              }
            }
          }
        `,
        variables: { token: refreshToken }
      })
    });

    // Log response headers for debugging
    const setCookieHeader = fetchResponse.headers.get('set-cookie');
    debug.auth("Refresh token response details:", {
      status: fetchResponse.status,
      statusText: fetchResponse.statusText,
      url: fetchResponse.url,
      currentDomain: window.location.hostname,
      currentProtocol: window.location.protocol,
      setCookieHeaders: setCookieHeader,
      hasCookieHeaders: !!setCookieHeader,
      allHeaders: Object.fromEntries(fetchResponse.headers.entries())
    });

    // Parse set-cookie headers to understand the cookie attributes
    if (setCookieHeader) {
      debug.auth("Set-Cookie header analysis:", {
        rawHeader: setCookieHeader,
        hasHttpOnly: setCookieHeader.includes('HttpOnly'),
        hasSecure: setCookieHeader.includes('Secure'),
        hasSameSite: setCookieHeader.includes('SameSite'),
        sameSiteValue: setCookieHeader.match(/SameSite=([^;]+)/)?.[1],
        hasDomain: setCookieHeader.includes('Domain'),
        domainValue: setCookieHeader.match(/Domain=([^;]+)/)?.[1],
        hasPath: setCookieHeader.includes('Path'),
        pathValue: setCookieHeader.match(/Path=([^;]+)/)?.[1]
      });
    } else {
      debug.warn("No set-cookie headers found in response - server may not be setting cookies");
    }

    if (!fetchResponse.ok) {
      throw new Error(`HTTP error! status: ${fetchResponse.status}`);
    }

    const responseData = await fetchResponse.json();

    if (responseData.errors) {
      throw new Error(responseData.errors[0]?.message || 'Refresh token failed');
    }

    const response = { RefreshToken: responseData.data.RefreshToken };

    debug.success("Token refreshed successfully");

    // Server automatically updates HttpOnly cookies with new tokens
    console.log("🔄 Token refresh successful - server updated cookies");

    // Debug cookie state before and after
    const cookiesBefore = document.cookie;
    debug.auth("Cookies before refresh response:", cookiesBefore);

    if (response.RefreshToken?.Credentials) {
      debug.auth("Refresh token response received - server manages cookie updates");
      debug.auth("New tokens received:", {
        hasAuthToken: !!response.RefreshToken.Credentials.token,
        hasRefreshToken: !!response.RefreshToken.Credentials.refresh_token,
        authTokenLength: response.RefreshToken.Credentials.token?.length,
        refreshTokenLength: response.RefreshToken.Credentials.refresh_token?.length
      });

      // Store new refresh token in localStorage as fallback
      if (response.RefreshToken.Credentials.refresh_token) {
        AuthStorage.setRefreshTokenLocalStorage(response.RefreshToken.Credentials.refresh_token);
        debug.auth('New refresh token stored in localStorage during refresh');
      }

      // For localhost development: Set cookies manually since server may not set them
      if (response.RefreshToken.Credentials.token) {
        AuthStorage.setTokensForLocalhost(
          response.RefreshToken.Credentials.token,
          response.RefreshToken.Credentials.refresh_token || undefined
        );
      }

      // Note: Server should set HttpOnly cookies automatically for auth tokens in production
      // We only manually set cookies for localhost development

      // Check cookies after a brief delay to see if they were updated
      setTimeout(() => {
        const cookiesAfter = document.cookie;
        debug.auth("Cookies after refresh response:", cookiesAfter);

        const authTokenAfter = AuthStorage.getAuthToken();
        const refreshTokenAfter = AuthStorage.getRefreshToken();
        debug.auth("Token check after refresh:", {
          authTokenFromCookie: authTokenAfter ? "Present" : "Missing",
          refreshTokenFromCookie: refreshTokenAfter ? "Present" : "Missing",
          authTokenLength: authTokenAfter?.length,
          refreshTokenLength: refreshTokenAfter?.length
        });
      }, 100);
    }

    return response.RefreshToken;
  } catch (error) {
    debug.error("Token refresh failed:", error);
    // Only clear tokens if the refresh actually failed
    // This allows retry logic to work properly
    throw error;
  }
};

export const updateUserDetails = () => ({
  mutationFn: async (user: UpdateUserInput) => {
    const client = await AuthenticatedClient();
    const response = await client.request(mutateUpdateUserDetails, {
      input: user
    });
    return response.UpdateUserDetails;
  }
})

export const fetchUserAnimes = (variables: UserAnimesQueryVariables) => ({
  queryKey: ["user-animes", variables],
  queryFn: async (): Promise<UserAnimesQuery["UserAnimes"]> => {
    const client = await AuthenticatedClient();
    const response = await client.request(queryUserAnimes, variables);
    return response.UserAnimes;
  },
});


export const upsertAnime = () => ({
  mutationFn: async (input: { input: UserAnimeInput }) => {
    return authenticatedRequest(async (client) => {
      const response = await client.request(mutateAddAnime, input);
      return response.AddAnime;
    });
  }
})

export const deleteAnime = () => ({
  mutationFn: async (input: string) => {
    debug.anime("Sending input to DeleteAnime:", input);
    const client = await AuthenticatedClient(); // ensure token read at call-time
    const response = await client.request(mutateDeleteAnime, {input});
    return response.DeleteAnime;
  }
})

export const getCharactersAndStaffByAnimeID = (id: string) => ({
  queryKey: ["charactersAndStaff", id],
  queryFn: async () => {
    const client = await AuthenticatedClient();
    const data = await client.request(queryCharactersAndStaffByAnimeID, {
      animeId: id
    })
    return data.charactersAndStaffByAnimeId;
  }
})
