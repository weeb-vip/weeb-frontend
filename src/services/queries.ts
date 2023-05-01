import api from "./api";
import {searchResults} from "./api/search";

export const fetchSearchResults = (query: string) => ({
  queryKey: ["search"],
  queryFn: () => api.search.search(query),
  select: (data: searchResults) => data,
})

export const fetchDetails = (thetvdbid: string, type: string) => ({
  queryKey: ["details", thetvdbid, type],
  queryFn: () => api.details.details(thetvdbid, type),
  select: (data: any) => data,
})

export const fetchSearchAdvancedResults = (query: string, year?: number, searchlimit?: number, limit?: number) => ({
  queryKey: ["searchAdvanced", query, year],
  queryFn: () => api.search.searchAdvanced(query, year, searchlimit),
  select: (data: searchResults) => limit ? data.slice(0, limit) : data,
})
