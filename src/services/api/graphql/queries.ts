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

export const getCurrentlyAiring = graphql(/* GraphQL */`
    query currentlyAiring {
      currentlyAiring {
        id
        titleEn
        titleJp
        endDate
        startDate
        imageUrl
        duration
        ranking
        nextEpisode {
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
      }
    }
`)

export const mutationRefreshToken = graphql(`
    mutation RefreshToken($token: String!) {
        RefreshToken(token: $token) {
            id
            Credentials {
                token
                refresh_token
            }
        }
    }
`)

export const mutationRegister = graphql(
    `
        mutation Register($input: RegisterInput!) {
            Register(input: $input) {
                id
            }
        }
  `
)

export const mutationCreateSession = graphql(
    `
        mutation CreateSession($input: LoginInput!) {
            CreateSession(input: $input) {
                id
                Credentials {
                    refresh_token
                    token
                }
            }
        }
  `
)

export const queryUserDetails = graphql(`
    query getUserDetails {
        UserDetails {
            id
            firstname
            lastname
            username
            language
            email
            active_sessions {
                id
                ip_address
                token
                user_agent
                user_id
            }
        }
    }`
)

export const mutateUpdateUserDetails = graphql(`
    mutation UpdateUserDetails($input: UpdateUserInput!) {
        UpdateUserDetails(input: $input) {
            id
            firstname
            lastname
            username
            language
            email
        }
    }
`)

export const queryUserAnimes = graphql(`
    query UserAnimes {
      UserAnimes {
        id
        userID
        animeID
        status
        score
        episodes
        rewatching
        rewatchingEpisodes
        tags
        listID
        createdAt
        updatedAt
        deletedAt
        anime {
          id
          titleEn
          titleJp
          titleRomaji
          titleKanji
          imageUrl
          startDate
          description
          episodeCount
          duration
        }
      }
    }
`)

export const mutateAddAnime = graphql(`
  mutation AddAnime($input: UserAnimeInput!) {
    AddAnime(input: $input) {
      id
    } 
  }
`)

export const mutateDeleteAnime = graphql(`
    mutation DeleteAnime($input: ID!) {
        DeleteAnime(id: $input)
    }
`)