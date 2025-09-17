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
  getCurrentlyAiring, getCurrentlyAiringWithDates,
  getHomePageData, getSeasonalAnime, mutateAddAnime, mutateDeleteAnime, mutateUpdateUserDetails,
  mutationCreateSession, mutationRefreshToken, mutationRequestPasswordReset, mutationResetPassword, mutationVerifyEmail, mutationResendVerificationEmail,
  mutationRegister, queryCharactersAndStaffByAnimeID, queryUserAnimes, queryUserDetails
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
  // @ts-ignore
  return new GraphQLClient(config.graphql_host, {
    headers: {
      Authorization: `Bearer ${token}`
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

export const fetchCurrentlyAiring = () => ({
  queryKey: ["currently-airing"],
  queryFn: async () => {
    return authenticatedRequest(async (client) => {
      // @ts-ignore
      return client.request<CurrentlyAiringQuery>(getCurrentlyAiring)
    });
  },
})

export const fetchCurrentlyAiringWithDates = (startDate: Date, endDate?: Date | null, days?: number) => ({
  queryKey: ["currentlyAiring"],
  queryFn: async () => {
    const client = await AuthenticatedClient();
    // @ts-ignore
    return client.request<CurrentlyAiringQuery>(getCurrentlyAiringWithDates, endDate ? {
      input: {
        startDate,
        endDate,
      }
    } : {
      input: {
        startDate,
        daysInFuture: days,
      }

    })
  },
})


export const register = () => ({
  mutationFn: async (input: { input: RegisterInput }): Promise<RegisterResult> => {
    const config = await getConfig();
    // @ts-ignore
    const response = await request(config.graphql_host, mutationRegister, input);
    return response.Register;
  }
})

export const login = () => ({
  mutationFn: async (input: { input: LoginInput }) => {
    const config = await getConfig();
    // @ts-ignore
    const response = await request(config.graphql_host, mutationCreateSession, input);
    return response.CreateSession;
  }
})

export const requestPasswordReset = () => ({
  mutationFn: async (input: { input: RequestPasswordResetInput }): Promise<boolean> => {
    const config = await getConfig();
    // @ts-ignore
    const response = await request(config.graphql_host, mutationRequestPasswordReset, input);
    return response.RequestPasswordReset;
  }
})

export const resetPassword = () => ({
  mutationFn: async (input: { input: ResetPasswordInput }): Promise<boolean> => {
    const config = await getConfig();
    // @ts-ignore
    const response = await request(config.graphql_host, mutationResetPassword, input);
    return response.ResetPassword;
  }
})

export const verifyEmail = (token: string) => ({
  mutationFn: async (): Promise<boolean> => {
    const config = await getConfig();
    // @ts-ignore
    const client = new GraphQLClient(config.graphql_host, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const response = await client.request(mutationVerifyEmail);
    return response.VerifyEmail;
  }
})

export const resendVerificationEmail = () => ({
  mutationFn: async (input: { username: string }): Promise<boolean> => {
    const config = await getConfig();
    // @ts-ignore
    const response = await request(config.graphql_host, mutationResendVerificationEmail, input);
    return response.ResendVerificationEmail;
  }
})

export const getUser = () => ({
  queryKey: ["user"],
  queryFn: async (): Promise<User> => {
    return authenticatedRequest(async (client) => {
      const response = await client.request(queryUserDetails);
      return response.UserDetails;
    });
  }
})

export const refreshTokenSimple = async (): Promise<SigninResult> => {
  const authtoken = AuthStorage.getAuthToken();
  if (!authtoken) throw new Error("Missing auth token in localStorage");

  let payload: any;
  try {
    payload = JSON.parse(atob(authtoken.split('.')[1]));
  } catch (e) {
    throw new Error("Failed to decode JWT payload");
  }

  const refreshToken = payload?.refresh_token;
  if (!refreshToken) throw new Error("No refresh_token found in JWT");

  debug.auth("Refreshing token...", refreshToken);

  const config = await getConfig();
  const response = await request<RefreshTokenMutation>(
    config.graphql_host,
    mutationRefreshToken,
    {token: refreshToken}
  );

  return response.RefreshToken;
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
    const config = await getConfig();
    // @ts-ignore
    const data = await request(config.graphql_host, queryCharactersAndStaffByAnimeID, {
      animeId: id
    })
    return data.charactersAndStaffByAnimeId;
  }
})
