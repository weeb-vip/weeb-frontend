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
            userAnime {
                id
                status
                score
            }
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
            userAnime {
                id
                status
                score
            }
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
            userAnime {
                id
                status
                score
            }
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
            userAnime {
                id
                status
                score
            }
        }
    }
`)

export const getCurrentlyAiring = graphql(/* GraphQL */`
    query currentlyAiring {
        currentlyAiring {
            id
            titleEn
            titleJp
            anidbid
            endDate
            startDate
            imageUrl
            duration
            ranking
            broadcast
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
            userAnime {
                id
                status
                score
            }
        }
    }
`)

export const getCurrentlyAiringWithDates = graphql(/* GraphQL */`
    query currentlyAiringWithDate($input: CurrentlyAiringInput) {
        currentlyAiring(input: $input) {
            id
            titleEn
            titleJp
            anidbid
            endDate
            startDate
            imageUrl
            duration
            ranking
            broadcast
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
            userAnime {
                id
                status
                score
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
    query UserAnimes($input: UserAnimesInput!) {
        UserAnimes(input: $input) {
            page
            limit
            total
            animes {
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


export const queryCharactersAndStaffByAnimeID = graphql(`
    query CharactersAndStaffByAnimeId($animeId: ID!) {
        charactersAndStaffByAnimeId(animeId: $animeId) {
            character {
                id
                animeId
                name
                role
                birthday
                zodiac
                gender
                race
                height
                weight
                title
                martialStatus
                summary
                image
                createdAt
                updatedAt

            }
            staff {
                id
                language
                givenName
                familyName
                image
                birthday
                birthPlace
                bloodType
                hobbies
                summary
                createdAt
                updatedAt
            }
        }
    }
`)
