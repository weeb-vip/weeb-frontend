import instance from './http'
import querystring from 'query-string'

export type searchResults = searchResult[]

export interface searchResult {
  objectID: string
  aliases: string[]
  country: string
  id: string
  image_url: string
  name: string
  first_air_time: string
  overview: string
  primary_language: string
  primary_type: string
  status: string
  type: string
  tvdb_id: string
  year: string
  slug: string
  overviews: Overviews
  translations: Translations
  network: string
  remote_ids: RemoteId[]
  thumbnail: string
  anidbid: string
}

export interface Overviews {
  deu: string
  eng: string
  fra: string
  ita: string
  jpn: string
  kor: string
  por: string
  rus: string
  spa: string
  zho: string
}

export interface Translations {
  deu: string
  eng: string
  fra: string
  jpn: string
  kor: string
  rus: string
  spa: string
  zho: string
}

export interface RemoteId {
  id: string
  type: number
  sourceName: string
}

export default {
  search: async (query: string): Promise<searchResults> => {
    const {
      data,
    }: {
      data: searchResults
    } = await instance.get(`/search?query=${encodeURIComponent(query)}`)// axios.get(`http://localhost:1337/search?query=${encodeURIComponent(query)}`)
    return data
  },
  searchAdvanced: async (query: string, year?: number, limit?: number): Promise<searchResults> => {
    const fullQuery = querystring.stringify({ query, year, limit })
    const {
      data,
    }: {
      data: searchResults
    } = await instance.get(`/search/advanced?${fullQuery}`)// axios.get(`http://localhost:1337/search?query=${encodeURIComponent(query)}`)
    return data
  }
}
