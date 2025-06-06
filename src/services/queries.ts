import api from "./api";
import {searchResults} from "./api/search";
import request, {GraphQLClient} from "graphql-request";
import {
  AddAnimeMutationVariables,
  CurrentlyAiringQuery,
  GetAnimeDetailsByIdQuery,
  GetHomePageDataQuery,
  LoginInput,
  MutationDeleteAnimeArgs,
  RefreshTokenMutation,
  RefreshTokenMutationVariables,
  RegisterInput,
  RegisterResult,
  SigninResult,
  UpdateUserInput,
  User,
  UserAnimeInput,
  UserAnimePaginated,
  UserAnimesQuery,
  UserAnimesQueryVariables
} from "../gql/graphql";
import {
  getAnimeDetailsByID,
  getCurrentlyAiring, getCurrentlyAiringWithDates,
  getHomePageData, mutateAddAnime, mutateDeleteAnime, mutateUpdateUserDetails,
  mutationCreateSession, mutationRefreshToken,
  mutationRegister, queryCharactersAndStaffByAnimeID, queryUserAnimes, queryUserDetails
} from "./api/graphql/queries";

;

// create authenticated client
export const AuthenticatedClient = () => {
  const token = localStorage.getItem("authToken");
  // @ts-ignore
  return new GraphQLClient(global.config.graphql_host, {
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
    const client = AuthenticatedClient();
    // @ts-ignore
    return client.request<GetHomePageDataQuery>(getHomePageData, {
      limit: 20 // variables are typed too!
    })
  },
})

export const fetchDetails = (id: string) => ({
  queryKey: ["anime-details", id],
  // @ts-ignore
  queryFn: async () => {
    if (!id) throw new Error("ID is required to fetch anime details");
    const client = AuthenticatedClient();
    // @ts-ignore
   return client.request<GetAnimeDetailsByIdQuery>(getAnimeDetailsByID, {
      id: id // variables are typed too!
    })
  }
})

export const fetchCurrentlyAiring = () => ({
  queryKey: ["currently-airing"],
  queryFn: async () => {
    const client = AuthenticatedClient();
    // @ts-ignore
    return client.request<CurrentlyAiringQuery>(getCurrentlyAiring)
  },
})

export const fetchCurrentlyAiringWithDates = (startDate: Date, endDate?: Date | null, days?: number) => ({
  queryKey: ["currentlyAiring"],
  queryFn: async () => {
    // @ts-ignore
    return request<CurrentlyAiringQuery>(global.config.graphql_host, getCurrentlyAiringWithDates, endDate ? {
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
    // @ts-ignore
    const response = await request(global.config.graphql_host, mutationRegister, input);
    return response.Register;
  }
})

export const login = () => ({
  mutationFn: async (input: { input: LoginInput }) => {
    // @ts-ignore
    const response = await request(global.config.graphql_host, mutationCreateSession, input);
    return response.CreateSession;
  }
})

export const getUser = () => ({
  queryKey: ["user"],
  queryFn: async (): Promise<User> => {
    const response = await AuthenticatedClient().request(queryUserDetails);
    return response.UserDetails;
  }
})

export const refreshTokenSimple = async (): Promise<SigninResult> => {
  const authtoken = localStorage.getItem("authToken");
  if (!authtoken) throw new Error("Missing auth token in localStorage");

  let payload: any;
  try {
    payload = JSON.parse(atob(authtoken.split('.')[1]));
  } catch (e) {
    throw new Error("Failed to decode JWT payload");
  }

  const refreshToken = payload?.refresh_token;
  if (!refreshToken) throw new Error("No refresh_token found in JWT");

  console.log("Refreshing token...", refreshToken);

  const response = await request<RefreshTokenMutation>(
    global.config.graphql_host,
    mutationRefreshToken,
    {token: refreshToken}
  );

  return response.RefreshToken;
};

export const updateUserDetails = async () => ({
  queryFn: async (user: UpdateUserInput) => {
    const response = await AuthenticatedClient().request(mutateUpdateUserDetails, {
      input: user
    });
    return response.UpdateUserDetails;
  }
})

export const fetchUserAnimes = (variables: UserAnimesQueryVariables) => ({
  queryKey: ["user-animes", variables],
  queryFn: async (): Promise<UserAnimesQuery["UserAnimes"]> => {
    const response = await AuthenticatedClient().request(queryUserAnimes, variables);
    return response.UserAnimes;
  },
});


export const upsertAnime = () => ({
  mutationFn: async (input: { input: UserAnimeInput }) => {
    const response = await AuthenticatedClient().request(mutateAddAnime, input);
    return response.AddAnime;
  }
})

export const deleteAnime = () => ({
  mutationFn: async (input: string) => {
    console.log("Sending input to DeleteAnime:", input); // ✅ Debug
    const client = AuthenticatedClient(); // ensure token read at call-time
    const response = await client.request(mutateDeleteAnime, {input});
    return response.DeleteAnime;
  }
})

export const getCharactersAndStaffByAnimeID = (id: string) => ({
  queryKey: ["charactersAndStaff", id],
  queryFn: async () => {
    // @ts-ignore
    const data = await request(global.config.graphql_host, queryCharactersAndStaffByAnimeID, {
      animeId: id
    })
    return data.charactersAndStaffByAnimeId;
  }
})