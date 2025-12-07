import {graphql} from "../../../gql";

export const getHomePageData = graphql(/* GraphQL */`
    query getHomePageData($limit: Int) {
        topRatedAnime(limit: $limit) {
            id
            anidbid
            thetvdbid
            titleEn
            titleJp
            imageUrl
            duration
            tags
            description
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
            thetvdbid
            titleEn
            titleJp
            imageUrl
            duration
            tags
            description
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

export const getSeasonalAnime = graphql(/* GraphQL */`
    query getSeasonalAnime($season: Season!) {
        animeBySeasons(season: $season) {
            id
            anidbid
            thetvdbid
            titleEn
            titleJp
            imageUrl
            duration
            tags
            description
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
            thetvdbid
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
    query currentlyAiring($limit: Int) {
        currentlyAiring(limit: $limit) {
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
            thetvdbid
            tags
            description
            nextEpisode {
                id
                animeId
                episodeNumber
                titleEn
                titleJp
                synopsis
                airDate
                airTime
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
    query currentlyAiringWithDate($input: CurrentlyAiringInput, $limit: Int) {
        currentlyAiring(input: $input, limit: $limit) {
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
            thetvdbid
            tags
            description
            nextEpisode {
                id
                animeId
                episodeNumber
                titleEn
                titleJp
                synopsis
                airDate
                airTime
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

export const getCurrentlyAiringWithDatesAndEpisodes = graphql(/* GraphQL */`
    query currentlyAiringWithDateAndEpisodes($input: CurrentlyAiringInput, $limit: Int) {
        currentlyAiring(input: $input, limit: $limit) {
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
            thetvdbid
            tags
            description
            nextEpisode {
                id
                animeId
                episodeNumber
                titleEn
                titleJp
                synopsis
                airDate
                airTime
            }
            episodes {
                id
                animeId
                episodeNumber
                titleEn
                titleJp
                synopsis
                airDate
                airTime
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

export const mutationRequestPasswordReset = graphql(
    `
        mutation RequestPasswordReset($input: RequestPasswordResetInput!) {
            RequestPasswordReset(input: $input)
        }
    `
)

export const mutationResetPassword = graphql(
    `
        mutation ResetPassword($input: ResetPasswordInput!) {
            ResetPassword(input: $input)
        }
    `
)

export const mutationVerifyEmail = graphql(
    `
        mutation VerifyEmail {
            VerifyEmail
        }
    `
)

export const mutationResendVerificationEmail = graphql(
    `
        mutation ResendVerificationEmail($username: String!) {
            ResendVerificationEmail(username: $username)
        }
    `
)

export const mutationLogout = graphql(
    `
        mutation Logout {
            Logout
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
            profileImageUrl
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
            profileImageUrl
        }
    }
`)

export const mutateUploadProfileImage = graphql(`
    mutation UploadProfileImage($image: Upload!) {
        UploadProfileImage(image: $image) {
            id
            firstname
            lastname
            username
            language
            email
            profileImageUrl
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
                    broadcast
                    thetvdbid
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
