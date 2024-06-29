import {graphql} from "../../../gql";

export const getHomePageData = graphql(/* GraphQL */`
    query getHomePageData($limit: Int) {
        topRatedAnime(limit: $limit) {
            id
            anidbid
            titleEn
            imageUrl
            duration
            tags
            episodeCount
            animeStatus
            imageUrl
            rating
            startDate
            ranking
        }
        mostPopularAnime(limit: $limit) {
            id
            anidbid
            titleEn
            imageUrl
            duration
            tags
            episodeCount
            animeStatus
            imageUrl
            rating
            startDate
            ranking
        }
        newestAnime(limit:100) {
            id
            anidbid
            titleEn
            imageUrl
            duration
            tags
            episodeCount
            animeStatus
            imageUrl
            rating
            startDate
            ranking
        }
    }
`)


export const getAnimeDetailsByID = graphql(/* GraphQL */`
    query getAnimeDetailsByID($id: ID!) {
    	anime(id: $id) {
            id
            anidbid
            titleEn
            titleJp
            titleRomaji
            titleKanji
            titleSynonyms
            description
            imageUrl
            tags
            studios
            animeStatus
            episodeCount
            episodes {
              id
              animeId
              episodeNumber
              titleEn
              titleJp
              synopsis
              airDate
              createdAt
              updatedAt
            }
            duration
            rating
            startDate
            endDate
            broadcast
            source
            licensors
            ranking
            createdAt
            updatedAt
          }
    }
`)

