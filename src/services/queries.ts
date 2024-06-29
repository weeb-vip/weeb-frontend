import api from "./api";
import {searchResults} from "./api/search";
import request from "graphql-request";
import {GetAnimeDetailsByIdQuery, GetHomePageDataQuery} from "../gql/graphql";
import {getAnimeDetailsByID, getHomePageData} from "./api/graphql/queries";
import {getConfig} from "../config";
import configApi from "./api/config";

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
