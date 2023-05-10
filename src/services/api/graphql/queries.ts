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
            episodes
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
            episodes
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
            episodes
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
        titleKanji
        titleRomaji
        titleSynonyms
        description
        imageUrl
        duration
        tags
        studios
        episodes
        animeStatus
        rating
        createdAt
        updatedAt
        startDate
        endDate
        broadcast
        ranking
        }
    }
`)
