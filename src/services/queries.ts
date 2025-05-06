import api from "./api";
import {searchResults} from "./api/search";
import request, {GraphQLClient} from "graphql-request";
import {
    CurrentlyAiringQuery,
    GetAnimeDetailsByIdQuery,
    GetHomePageDataQuery, LoginInput,
    RegisterInput,
    RegisterResult, SigninResult, User
} from "../gql/graphql";
import {
    getAnimeDetailsByID,
    getCurrentlyAiring,
    getHomePageData,
    mutationCreateSession, mutationRefreshToken,
    mutationRegister, queryUserDetails
} from "./api/graphql/queries";
import {getConfig} from "../config";
import configApi from "./api/config";

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
        // @ts-ignore
        return request<GetHomePageDataQuery>(global.config.graphql_host, getHomePageData, {
            limit: 20 // variables are typed too!
        })
    },
})

export const fetchDetails = (id: string) => ({
    queryKey: ["detailsCustom", id],
    // @ts-ignore
    queryFn: async () => request<GetAnimeDetailsByIdQuery>(global.config.graphql_host, getAnimeDetailsByID, {
        id: id // variables are typed too!
    })
})

export const fetchCurrentlyAiring = () => ({
    queryKey: ["currentlyAiring"],
    queryFn: async () => {
        // @ts-ignore
        return request<CurrentlyAiringQuery>(global.config.graphql_host, getCurrentlyAiring)
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
    // get token from local storage
    const authtoken = localStorage.getItem("authToken");
    // extract token from authtoken jwt
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const payload = JSON.parse(atob(authtoken.split('.')[1]));
    // extract refresh_token from payload
    const refreshToken = payload.refresh_token;
    console.log("Refreshing token...", refreshToken);

    const input = {token: refreshToken};
    const response = await AuthenticatedClient().request(mutationRefreshToken, input);
    return response.RefreshToken
}