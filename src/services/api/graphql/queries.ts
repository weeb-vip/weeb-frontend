import {graphql} from "../../../gql";

const getHomePageData = graphql(/* GraphQL */`
    query getHomePageData($limit: Int) {
        topRatedAnime(limit: $limit) {
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
        }
        mostPopularAnime(limit: $limit) {
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
        }
        newestAnime(limit:100) {
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
        }
    }
`)

export { getHomePageData }