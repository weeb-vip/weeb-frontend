import {graphql} from "../../../gql";

export const getHomePageData = graphql(/* GraphQL */`
    query getHomePageData($limit: Int) {
        topRatedAnime(limit: $limit) {
            id
            anidbid
            thetvdbid
            slug
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
                episodes
            }
        }
    }
`)

export const getSeasonalAnime = graphql(/* GraphQL */`
    query getSeasonalAnime($season: Season!, $limit: Int) {
        animeBySeasons(season: $season, limit: $limit) {
            id
            anidbid
            thetvdbid
            slug
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
                episodes
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
            malId
            # The work this anime adapts, when known. Null for originals and for
            # sources MyAnimeList does not cover, which is most of the catalogue.
            sourceWork {
                id
                urlSlug
                titleEn
                titleJp
                type
            }
            slug
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
            type
            relatedAnime {
                relation
                anime {
                    id
                    slug
                    titleEn
                    titleJp
                    imageUrl
                    type
                    startDate
                    animeStatus
                }
            }
            duration
            rating
            startDate
            endDate
            broadcast
            source
            licensors
            ranking
            scheduleInfo {
                jpnTime
                subTime
                dubTime
                notes
                delayedTimetable
                subDelayedTimetable
                dubDelayedTimetable
            }
            streamingPlatforms {
                platform
                name
                url
            }
            createdAt
            updatedAt
            news {
                id
                title
                summary
                category
                sourceUrl
                sourceName
                publishedDate
                episodeNumber
                language
                references {
                    kind
                    title
                    url
                }
            }
            userAnime {
                id
                status
                score
                episodes
            }
        }
    }
`)

// Just the slug, for redirecting /show/<id> to /anime/<slug>. The redirect is
// on the hot path for every legacy URL Google still has indexed, so it must not
// drag in episodes, news and characters just to read one string.
export const getAnimeSlugByID = graphql(/* GraphQL */`
    query getAnimeSlugByID($id: ID!) {
        anime(id: $id) {
            id
            slug
        }
    }
`)

// Same selection set as getAnimeDetailsByID, resolved by slug instead of id.
// The duplication is deliberate -- this codebase uses no fragments, and the
// client-preset's fragment masking would force useFragment() through every
// consumer. queries.test.ts asserts the two stay identical, because the last
// hand-maintained copy of this selection set silently lost userAnime.episodes.
export const getAnimeDetailsBySlug = graphql(/* GraphQL */`
    query getAnimeDetailsBySlug($slug: String!) {
        animeBySlug(slug: $slug) {
            id
            anidbid
            thetvdbid
            malId
            # The work this anime adapts, when known. Null for originals and for
            # sources MyAnimeList does not cover, which is most of the catalogue.
            sourceWork {
                id
                urlSlug
                titleEn
                titleJp
                type
            }
            slug
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
            type
            relatedAnime {
                relation
                anime {
                    id
                    slug
                    titleEn
                    titleJp
                    imageUrl
                    type
                    startDate
                    animeStatus
                }
            }
            duration
            rating
            startDate
            endDate
            broadcast
            source
            licensors
            ranking
            scheduleInfo {
                jpnTime
                subTime
                dubTime
                notes
                delayedTimetable
                subDelayedTimetable
                dubDelayedTimetable
            }
            streamingPlatforms {
                platform
                name
                url
            }
            createdAt
            updatedAt
            news {
                id
                title
                summary
                category
                sourceUrl
                sourceName
                publishedDate
                episodeNumber
                language
                references {
                    kind
                    title
                    url
                }
            }
            userAnime {
                id
                status
                score
                episodes
            }
        }
    }
`)


// Just enough for /show/[id]/news — the full detail query drags in episodes,
// characters and userAnime that this page never renders.
// The source work behind /manga/<slug>: manga, light novel, novel, manhwa.
//
// adaptations is asked for in the same round trip rather than as a second query.
// It is the reason the page exists -- the other anime made from this work -- and
// it is usually empty, so a separate request would spend a round trip to learn
// there is nothing to show.
// The homepage's reading row: ongoing works, most widely read first.
//
// Only the fields a card draws. The synopsis in particular is deliberately
// absent -- it is the widest column in the table, and a row of twelve covers
// has nowhere to put it.
export const getCurrentlyPublishingWorks = graphql(/* GraphQL */`
    query getCurrentlyPublishingWorks($limit: Int) {
        currentlyPublishingWorks(limit: $limit) {
            id
            urlSlug
            titleEn
            titleJp
            type
            score
            publishedFrom
        }
    }
`);

export const getWorkBySlug = graphql(/* GraphQL */`
    query getWorkBySlug($slug: String!) {
        workBySlug(slug: $slug) {
            id
            malId
            type
            urlSlug
            titleEn
            titleJp
            titleSynonyms
            synopsis
            imageUrl
            status
            volumes
            chapters
            publishedFrom
            publishedTo
            demographic
            serialization
            authors
            score
            ranking
            # The viewer's own row, resolved by list-service off the Work entity.
            # Null when signed out or not on their shelf, which is the same
            # answer and the same rendering.
            userWork {
                id
                status
                score
                chapters
                volumes
            }
            adaptations(limit: 24) {
                id
                slug
                titleEn
                titleJp
                imageUrl
                startDate
                rating
                animeStatus
                episodeCount
                tags
            }
        }
    }
`)

// A reader's shelf, by status. The reading counterpart of UserAnimes.
//
// `work` is resolved through federation (anime-api extends UserWork), so the
// title, cover and slug a card needs arrive in the same round trip rather than
// as a lookup per row -- there is no batch works-by-id query to make them from
// otherwise.
export const queryUserWorks = graphql(/* GraphQL */`
    query UserWorks($input: UserWorksInput!) {
        UserWorks(input: $input) {
            page
            limit
            total
            works {
                id
                userID
                workID
                status
                score
                chapters
                volumes
                createdAt
                updatedAt
                work {
                    id
                    urlSlug
                    titleEn
                    titleJp
                    type
                    imageUrl
                    status
                    chapters
                    volumes
                    score
                    publishedFrom
                }
            }
        }
    }
`)

// Every status count in one request, for the profile tabs. Replaces a count
// query per tab: the set of statuses is fixed, so one grouped query answers all
// of them and a signed-in list page spends one round trip on its tab numbers
// rather than five.
export const queryUserWorkStatusCounts = graphql(/* GraphQL */`
    query UserWorkStatusCounts {
        UserWorkStatusCounts {
            reading
            planToRead
            completed
            onHold
            dropped
        }
    }
`)

export const queryUserAnimeStatusCounts = graphql(/* GraphQL */`
    query UserAnimeStatusCounts {
        UserAnimeStatusCounts {
            watching
            planToWatch
            completed
            onHold
            dropped
        }
    }
`)

export const mutateAddWork = graphql(/* GraphQL */`
    mutation AddWork($input: UserWorkInput!) {
        AddWork(input: $input) {
            id
            status
            chapters
            volumes
            score
        }
    }
`)

// Add and update are the same call: list-service keys the write on (user, work),
// so setting a status on something already tracked updates it rather than
// creating a second row. Kept as its own document anyway, because the caller
// knows which it means and the mutation name is what shows up in traces.
export const mutateUpdateWork = graphql(/* GraphQL */`
    mutation UpdateWork($input: UserWorkInput!) {
        UpdateWork(input: $input) {
            id
            status
            chapters
            volumes
            score
        }
    }
`)

export const mutateDeleteWork = graphql(/* GraphQL */`
    mutation DeleteWork($input: ID!) {
        DeleteWork(id: $input)
    }
`)

// Which episodes a viewer has finished, as numbers rather than ids: the scraper
// clears an anime's episodes and reinserts them with new ids, so history keyed
// on an id would be lost on every re-scrape.
export const queryWatchedEpisodes = graphql(/* GraphQL */`
    query WatchedEpisodes($animeID: String!) {
        WatchedEpisodes(animeID: $animeID) {
            id
            episodeNumber
            watchedAt
        }
    }
`)

export const mutateMarkEpisodeWatched = graphql(/* GraphQL */`
    mutation MarkEpisodeWatched($input: MarkEpisodeInput!) {
        MarkEpisodeWatched(input: $input) {
            id
            episodeNumber
        }
    }
`)

export const mutateUnmarkEpisodeWatched = graphql(/* GraphQL */`
    mutation UnmarkEpisodeWatched($input: MarkEpisodeInput!) {
        UnmarkEpisodeWatched(input: $input)
    }
`)

export const queryReadChapters = graphql(/* GraphQL */`
    query ReadChapters($workID: String!) {
        ReadChapters(workID: $workID) {
            id
            chapterNumber
            readAt
        }
    }
`)

export const mutateMarkChapterRead = graphql(/* GraphQL */`
    mutation MarkChapterRead($input: MarkChapterInput!) {
        MarkChapterRead(input: $input) {
            id
            chapterNumber
        }
    }
`)

export const mutateUnmarkChapterRead = graphql(/* GraphQL */`
    mutation UnmarkChapterRead($input: MarkChapterInput!) {
        UnmarkChapterRead(input: $input)
    }
`)

export const getAnimeNewsByID = graphql(/* GraphQL */`
    query getAnimeNewsByID($id: ID!) {
        anime(id: $id) {
            id
            slug
            titleEn
            titleJp
            imageUrl
            startDate
            studios
            tags
            news {
                id
                title
                summary
                category
                sourceUrl
                sourceName
                publishedDate
                episodeNumber
                language
                references {
                    kind
                    title
                    url
                }
            }
        }
    }
`)

// Same selection set as getAnimeNewsByID, resolved by slug.
// queries.test.ts keeps the two in step.
export const getAnimeNewsBySlug = graphql(/* GraphQL */`
    query getAnimeNewsBySlug($slug: String!) {
        animeBySlug(slug: $slug) {
            id
            slug
            titleEn
            titleJp
            imageUrl
            startDate
            studios
            tags
            news {
                id
                title
                summary
                category
                sourceUrl
                sourceName
                publishedDate
                episodeNumber
                language
                references {
                    kind
                    title
                    url
                }
            }
        }
    }
`)


export const getCurrentlyAiring = graphql(/* GraphQL */`
    query currentlyAiring($limit: Int) {
        currentlyAiring(limit: $limit) {
            id
            slug
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
                episodes
            }
        }
    }
`)

export const getCurrentlyAiringWithDates = graphql(/* GraphQL */`
    query currentlyAiringWithDate($input: CurrentlyAiringInput, $limit: Int) {
        currentlyAiring(input: $input, limit: $limit) {
            id
            slug
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
            streamingPlatforms {
                platform
                name
                url
            }
            userAnime {
                id
                status
                score
                episodes
            }
        }
    }
`)

export const getCurrentlyAiringWithDatesAndEpisodes = graphql(/* GraphQL */`
    query currentlyAiringWithDateAndEpisodes($input: CurrentlyAiringInput, $limit: Int) {
        currentlyAiring(input: $input, limit: $limit) {
            id
            slug
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
                episodes
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
            bannerImageUrl
            bio
            accentColor
            listsPublic
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
            bannerImageUrl
            bio
            accentColor
            listsPublic
        }
    }
`)

// A user's public page, by username. Returns only the header-safe subset -- the
// backend guarantees no email or sessions can be selected here.
// Public reads for a user's page, by their id. Not authenticated -- the page
// above only calls these when the viewed user has opted their lists public.
export const queryPublicUserAnimeStatusCounts = graphql(`
    query PublicUserAnimeStatusCounts($userID: String!) {
        PublicUserAnimeStatusCounts(userID: $userID) {
            watching
            planToWatch
            completed
            onHold
            dropped
        }
    }
`)

export const queryPublicUserWorkStatusCounts = graphql(`
    query PublicUserWorkStatusCounts($userID: String!) {
        PublicUserWorkStatusCounts(userID: $userID) {
            reading
            planToRead
            completed
            onHold
            dropped
        }
    }
`)

export const queryPublicUserAnimes = graphql(`
    query PublicUserAnimes($userID: String!, $input: UserAnimesInput!) {
        PublicUserAnimes(userID: $userID, input: $input) {
            total
            animes {
                id
                animeID
                status
                episodes
                anime {
                    id
                    slug
                    titleEn
                    titleJp
                    imageUrl
                    episodeCount
                    animeStatus
                    tags
                    description
                }
            }
        }
    }
`)

export const queryPublicUserWorks = graphql(`
    query PublicUserWorks($userID: String!, $input: UserWorksInput!) {
        PublicUserWorks(userID: $userID, input: $input) {
            total
            works {
                id
                workID
                status
                chapters
                work {
                    id
                    urlSlug
                    titleEn
                    titleJp
                    type
                    imageUrl
                    score
                    publishedFrom
                    chapters
                }
            }
        }
    }
`)

export const getUserByUsername = graphql(`
    query getUserByUsername($username: String!) {
        userByUsername(username: $username) {
            id
            username
            firstname
            lastname
            profileImageUrl
            bannerImageUrl
            bio
            accentColor
            listsPublic
        }
    }
`)

export const mutateUploadBannerImage = graphql(`
    mutation UploadBannerImage($image: Upload!) {
        UploadBannerImage(image: $image) {
            id
            username
            profileImageUrl
            bannerImageUrl
            bio
            accentColor
            listsPublic
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
            bannerImageUrl
            bio
            accentColor
            listsPublic
        }
    }
`)

// Counts only. The profile page shows "Completed / On hold / Dropped" as
// numbers and nothing else, so it has no use for the rows behind them.
//
// UserAnimes computes total with its own COUNT(*) over
// (user_id, status), independent of limit, and idx_user_anime_user_id_status
// covers that exactly -- so asking for the count costs one index scan and
// returns no rows at all.
//
// It is also the correct number. Reading animes.length instead caps at the
// page limit: a user with 3,460 completed and limit 1000 was shown 1000.
export const queryUserAnimeCount = graphql(`
    query UserAnimeCount($input: UserAnimesInput!) {
        UserAnimes(input: $input) {
            total
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
                    slug
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
                    tags
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
                slug
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

// The voice actor page. anime_staff carries no anime_id and is deduplicated on
// name by the scraper, so `roles` is the whole of this person's credited work
// rather than the slice belonging to one anime.
export const queryStaffByID = graphql(`
    query StaffById($id: ID!) {
        staff(id: $id) {
            id
            slug
            givenName
            familyName
            language
            image
            birthday
            birthPlace
            bloodType
            hobbies
            summary
            roles {
                character {
                    id
                    name
                    role
                    image
                }
                anime {
                    id
                    slug
                    titleEn
                    titleJp
                    imageUrl
                    startDate
                    animeStatus
                }
            }
        }
    }
`)

// The slug twin of queryStaffByID. Same selection set: the page renders
// whichever of the two answered, so they must not drift.
export const queryStaffBySlug = graphql(`
    query StaffBySlug($slug: String!) {
        staffBySlug(slug: $slug) {
            id
            slug
            givenName
            familyName
            language
            image
            birthday
            birthPlace
            bloodType
            hobbies
            summary
            roles {
                character {
                    id
                    name
                    role
                    image
                }
                anime {
                    id
                    slug
                    titleEn
                    titleJp
                    imageUrl
                    startDate
                    animeStatus
                }
            }
        }
    }
`)
