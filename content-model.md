# Content Model - weeb.vip

Extracted from the GraphQL schema, REST API types, and page/component structure.
No visual or styling information included.

---

## Entity Types

### Anime
The core entity. Represents a single anime series.

| Field | Type | Notes |
|-------|------|-------|
| id | ID | Primary key |
| anidbid | String | AniDB external ID |
| thetvdbid | String | TheTVDB external ID |
| titleEn | String | English title |
| titleJp | String | Japanese title |
| titleRomaji | String | Romanized Japanese title |
| titleKanji | String | Kanji title |
| titleSynonyms | [String] | Alternate names |
| description | String | Synopsis / summary |
| imageUrl | String | Cover / poster image |
| tags | [String] | Genre / topic tags |
| studios | [String] | Production studios |
| animeStatus | String | finished, airing, upcoming |
| episodeCount | Int | Total episode count |
| duration | String | Episode duration |
| rating | String | Content rating |
| ranking | Int | Popularity / quality rank |
| startDate | DateTime | First air date |
| endDate | DateTime | Last air date |
| broadcast | String | Broadcast schedule (day/time) |
| source | String | Data source (myanimelist, anidb, anilist, kitsu, etc.) |
| licensors | [String] | Licensing companies |
| episodes | [Episode] | All episodes |
| nextEpisode | Episode | Next upcoming episode (for airing shows) |
| seasons | [AnimeSeason] | Season groupings |
| userAnime | UserAnime | Current user tracking data (if logged in) |

### Episode

| Field | Type | Notes |
|-------|------|-------|
| id | ID | |
| animeId | String | Parent anime |
| episodeNumber | Int | |
| titleEn | String | English episode title |
| titleJp | String | Japanese episode title |
| synopsis | String | Episode summary |
| airDate | DateTime | Original air date |
| airTime | DateTime | Calculated air time with timezone |

### AnimeSeason

| Field | Type | Notes |
|-------|------|-------|
| id | ID | |
| animeId | String | Parent anime |
| season | Season | e.g. SPRING_2024 |
| status | AnimeSeasonStatus | ANNOUNCED, CONFIRMED, CANCELLED, UNKNOWN |
| episodeCount | Int | |
| notes | String | |

### AnimeCharacter

| Field | Type | Notes |
|-------|------|-------|
| id | ID | |
| animeId | String | Parent anime |
| name | String | |
| role | String | main, supporting |
| image | String | Character image URL |
| gender | String | |
| race | String | e.g. human, elf, demon |
| birthday | String | |
| zodiac | String | |
| height | String | |
| weight | String | |
| title | String | e.g. The Hero |
| martialStatus | String | |
| summary | String | Bio / background |
| staff | [AnimeStaff] | Voice actors for this character |

### AnimeStaff (Voice Actor / Staff)

| Field | Type | Notes |
|-------|------|-------|
| id | ID | |
| givenName | String | |
| familyName | String | |
| image | String | |
| language | String | Voice language |
| birthday | String | |
| birthPlace | String | |
| bloodType | String | |
| hobbies | String | |
| summary | String | Career bio |
| characters | [AnimeCharacter] | Characters they voice |

### User

| Field | Type | Notes |
|-------|------|-------|
| id | ID | |
| username | String | |
| email | String | |
| firstname | String | |
| lastname | String | |
| language | Language | EN or TH |
| profileImageUrl | String | Avatar |
| active_sessions | [SessionDetails] | Currently active login sessions |

### Session / SessionDetails

| Field | Type | Notes |
|-------|------|-------|
| id | String | |
| user_id | String | |
| ip_address | String | |
| user_agent | String | Browser / device info |
| token | String | |

### UserAnime (User tracking entry for an anime)

| Field | Type | Notes |
|-------|------|-------|
| id | ID | |
| userID | String | |
| animeID | String | |
| status | Status | WATCHING, COMPLETED, ONHOLD, DROPPED, PLANTOWATCH |
| score | Float | User rating |
| episodes | Int | Episodes watched |
| rewatching | Int | Rewatch count |
| rewatchingEpisodes | Int | Episodes watched in current rewatch |
| tags | [String] | User-applied tags |
| listID | String | Optional custom list assignment |

### UserList (Custom list)

| Field | Type | Notes |
|-------|------|-------|
| id | ID | |
| userID | String | |
| name | String | List name |
| description | String | |
| type | String | |
| isPublic | Boolean | |
| tags | [String] | |

### Link (TheTVDB cross-reference)

| Field | Type | Notes |
|-------|------|-------|
| id | ID | |
| animeID | String | |
| thetvdbID | String | |
| name | String | Anime name |
| season | Int | |

---

## Enums

**Status** (user tracking): WATCHING, COMPLETED, ONHOLD, DROPPED, PLANTOWATCH

**AnimeSeasonStatus**: ANNOUNCED, CONFIRMED, CANCELLED, UNKNOWN

**Language**: EN, TH

---

## Surfaces / Pages

| Page | Route | Purpose |
|------|-------|---------|
| Homepage | / | Discovery: top rated, newest anime, hero banner |
| Show Detail | /show/:id | Full anime info, episodes, characters+staff, tracking controls |
| Season | /season/:season | Anime filtered by season |
| Currently Airing | /airing | Airing shows with next episode info |
| Airing Calendar | /airing/calendar | Calendar view of upcoming air dates |
| Search | (autocomplete overlay) | Live search with filters |
| Profile | /profile | User profile overview |
| Profile Anime List | /profile/anime | Tracked anime, filterable by status, paginated |
| Profile Settings | /settings | Edit user details, upload avatar |
| Login | /auth/login | Also available as modal |
| Register | /auth/register | Account creation |
| Email Verification | /auth/verification | Verify via token |
| Resend Verification | /auth/resend-verification | Request new verification email |
| Password Reset Request | /auth/password-reset-request | Request reset |
| Password Reset | /auth/password-reset | Set new password via token |
| About | /about | About page |
| 404 | /404 | Not found |

---

## Core User Actions

### Anonymous
- Search anime: text query with optional year, limit, tags, studios, status filters, sort
- Browse homepage: view top rated, newest anime
- Browse by season: view anime by seasonal grouping
- Browse currently airing: see airing now with next episode times
- View anime detail: full metadata, episode list, characters and voice actors
- Register: username + password
- Login: username + password, creates session with JWT tokens

### Authenticated
- Add anime to tracking: set status, score, episodes watched
- Update anime tracking: change status, score, episode count, rewatch count, tags
- Remove anime from tracking: delete tracking entry
- Create custom list: name, description, public/private, tags
- Delete custom list
- Update profile: edit firstname, lastname, username, email, language
- Upload profile image
- Change password (old + new)
- Logout
- View active sessions

### Auth Lifecycle
- Token refresh: automatic JWT refresh with retry
- Email verification: verify via token link
- Resend verification email
- Request password reset: by username + email
- Reset password: via token

### System / Background
- Episode notifications: web worker polls for upcoming air times, triggers browser notifications
- Currently airing polling: date-range queries for airing schedule

---

## Data Queries (API Surface)

### Queries
| Query | Purpose |
|-------|---------|
| topRatedAnime(limit) | Homepage top rated |
| newestAnime(limit) | Homepage newest |
| mostPopularAnime(limit) | Most popular |
| anime(id) | Single anime detail |
| dbSearch(query, page, perPage, sortBy, tags, studios, statuses) | Search with filters |
| animeBySeasons(season, limit) | Seasonal browse |
| animeBySeasonAndYear(seasonName, year, limit) | Flexible seasonal browse |
| currentlyAiring(input, limit) | Airing schedule with date range |
| episodesByAnimeId(animeId) | Episode list |
| charactersAndStaffByAnimeId(animeId) | Characters + voice actors |
| UserAnimes(input) | User tracked anime (paginated, filterable) |
| UserDetails | Current user profile |
| UserLists | User custom lists |

### Mutations
| Mutation | Purpose |
|----------|---------|
| AddAnime(input) | Add/upsert anime tracking |
| UpdateAnime(input) | Update tracking |
| DeleteAnime(id) | Remove tracking |
| CreateList(input) | Create custom list |
| DeleteList(id) | Delete custom list |
| Register(input) | Create account |
| CreateSession(input) | Login |
| Logout | End session |
| RefreshToken(token) | Refresh JWT |
| UpdateUserDetails(input) | Edit profile |
| UploadProfileImage(image) | Upload avatar |
| RequestPasswordReset(input) | Initiate reset |
| ResetPassword(input) | Complete reset |
| VerifyEmail | Verify email |
| ResendVerificationEmail(username) | Resend verification |
