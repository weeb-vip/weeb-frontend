/* eslint-disable */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  /** RFC3339 formatted Date */
  Date: any;
  Int64: any;
  Season: any;
  /** RFC3339 formatted DateTime */
  Time: any;
  Upload: any;
};

/** Air type for schedule times (raw Japanese broadcast, subtitled, dubbed) */
export enum AirType {
  Dub = 'DUB',
  Raw = 'RAW',
  Sub = 'SUB'
}

/** Anime Type */
export type Anime = {
  __typename?: 'Anime';
  /** AniDB ID of the anime */
  anidbid?: Maybe<Scalars['String']>;
  /** Anime status (finished, airing, upcoming) */
  animeStatus?: Maybe<Scalars['String']>;
  /** Anime broadcast */
  broadcast?: Maybe<Scalars['String']>;
  createdAt: Scalars['String'];
  /** Description of the anime */
  description?: Maybe<Scalars['String']>;
  /** Anime episode duration */
  duration?: Maybe<Scalars['String']>;
  /** Anime last air date */
  endDate?: Maybe<Scalars['Time']>;
  /** Anime episode count */
  episodeCount?: Maybe<Scalars['Int']>;
  /** returns all episodes of the anime */
  episodes?: Maybe<Array<Episode>>;
  /** Fanart / visuals gathered for this anime */
  fanart?: Maybe<Array<Fanart>>;
  /** ID of the anime */
  id: Scalars['ID'];
  /** Image URL of the anime */
  imageUrl?: Maybe<Scalars['String']>;
  /** Anime licensors */
  licensors?: Maybe<Array<Scalars['String']>>;
  /** MAL ID for cross-referencing */
  malId?: Maybe<Scalars['Int']>;
  /** AI-researched news for this anime */
  news?: Maybe<Array<AnimeNews>>;
  nextEpisode?: Maybe<Episode>;
  /** Anime rank */
  ranking?: Maybe<Scalars['Int']>;
  /** Anime rating */
  rating?: Maybe<Scalars['String']>;
  /**
   * Anime connected to this one, oldest first, undated last.
   *
   *   Each entry says how it is connected rather than leaving the caller to
   *   assume, because the kinds are not interchangeable: another entry in the
   *   same series is the same show, while a spin-off or an adaptation is a
   *   different one. Presenting both under a single heading would flatten that.
   *
   *   Empty for anime we know of no connection for, which is most of the
   *   catalogue; treat an empty list as "not known", not as "stands alone".
   */
  relatedAnime?: Maybe<Array<RelatedAnime>>;
  /** Schedule info from AnimeSchedule.net */
  scheduleInfo?: Maybe<AnimeScheduleInfo>;
  /**
   * Which season of its series this is, when we know.
   *
   *   MyAnimeList files each broadcast run as its own anime while TheTVDB keeps
   *   them as seasons of one series, so two entries can share a thetvdbid and
   *   differ only in which run they are. This is that number, derived from the
   *   air dates the two sources agree on.
   *
   *   Null means unknown, and most of the catalogue is null: the derivation
   *   refuses rather than guessing, and two thirds of our anime carry no
   *   thetvdbid at all. 0 is not unknown -- it is TheTVDB\'s specials season,
   *   which a caller should render as "Special" rather than as season zero.
   */
  seasonNumber?: Maybe<Scalars['Int']>;
  /** Anime seasons */
  seasons?: Maybe<Array<AnimeSeason>>;
  /**
   * Public URL segment for the anime, e.g. "cowboy-bebop". Derived from the
   *   title, with a year and type appended only where several anime would
   *   otherwise claim the same slug. Null for records the backfill has not
   *   reached; callers should fall back to the id.
   */
  slug?: Maybe<Scalars['String']>;
  /** Anime source (myanimelist, anime-planet, anidb, anilist, kitsu, anime_news_network) */
  source?: Maybe<Scalars['String']>;
  /**
   * The work this anime adapts, resolved. Null for originals and for sources
   *   MyAnimeList's manga database does not cover, which together are most of the
   *   catalogue.
   */
  sourceWork?: Maybe<Work>;
  /**
   * The work this anime adapts, when we know it -- the manga or novel, not the
   *   category `source` gives. Null for originals and for sources MyAnimeList's
   *   manga database does not cover, which together are most of the catalogue.
   *
   *   Exposed because relatedAnime resolves SHARED_SOURCE from it.
   */
  sourceWorkId?: Maybe<Scalars['String']>;
  /** Anime first air date */
  startDate?: Maybe<Scalars['Time']>;
  /** Streaming platforms where this anime is available */
  streamingPlatforms?: Maybe<Array<StreamingPlatform>>;
  /** Studios of the anime */
  studios?: Maybe<Array<Scalars['String']>>;
  /** Tags of the anime */
  tags?: Maybe<Array<Scalars['String']>>;
  /** TheTVDB ID of the anime */
  thetvdbid?: Maybe<Scalars['String']>;
  /** English titel the anime */
  titleEn?: Maybe<Scalars['String']>;
  /** Japanese titel the anime */
  titleJp?: Maybe<Scalars['String']>;
  /** Kanji titel the anime */
  titleKanji?: Maybe<Scalars['String']>;
  /** Romaji titel the anime */
  titleRomaji?: Maybe<Scalars['String']>;
  /** Synonyms of the anime */
  titleSynonyms?: Maybe<Array<Scalars['String']>>;
  /**
   * Record type as the source classifies it -- TV, Movie, OVA, ONA, Special and
   *   so on. Exposed because it is what separates a main entry from a side story
   *   in relatedAnime, where a list of titles alone does not say which is which.
   */
  type?: Maybe<Scalars['String']>;
  updatedAt: Scalars['String'];
  userAnime?: Maybe<UserAnime>;
};


/** Anime Type */
export type AnimeRelatedAnimeArgs = {
  limit?: InputMaybe<Scalars['Int']>;
};

export type AnimeApi = {
  __typename?: 'AnimeApi';
  /** Version of event anime-api service */
  version: Scalars['String'];
};

export type AnimeCharacter = {
  __typename?: 'AnimeCharacter';
  /** The ID of the anime this character belongs to */
  animeId: Scalars['String'];
  /** The character's birthdate (if known) */
  birthday?: Maybe<Scalars['String']>;
  /** Timestamp when the character was created in the database */
  createdAt?: Maybe<Scalars['Time']>;
  /** The character's gender (e.g., male, female, non-binary) */
  gender?: Maybe<Scalars['String']>;
  /** The character's height */
  height?: Maybe<Scalars['String']>;
  /** Unique identifier for the character */
  id: Scalars['ID'];
  /** URL or path to the character's image */
  image?: Maybe<Scalars['String']>;
  /** The character's marital status (e.g., single, married, unknown) */
  martialStatus?: Maybe<Scalars['String']>;
  /** Name of the character */
  name: Scalars['String'];
  /** The character's race (e.g., human, elf, demon) */
  race?: Maybe<Scalars['String']>;
  /** The role of the character (e.g., main, supporting) */
  role: Scalars['String'];
  /** The voice actor for the character */
  staff?: Maybe<Array<AnimeStaff>>;
  /** A brief summary of the character's background or story */
  summary?: Maybe<Scalars['String']>;
  /** The character's title (e.g., 'The Hero', 'The King') */
  title?: Maybe<Scalars['String']>;
  /** Timestamp when the character was last updated in the database */
  updatedAt?: Maybe<Scalars['Time']>;
  /** The character's weight */
  weight?: Maybe<Scalars['String']>;
  /** The character's zodiac sign (if known) */
  zodiac?: Maybe<Scalars['String']>;
};

/** One AI-researched news item about an anime. */
export type AnimeNews = {
  __typename?: 'AnimeNews';
  animeId: Scalars['ID'];
  category: Scalars['String'];
  episodeNumber?: Maybe<Scalars['Int']>;
  id: Scalars['ID'];
  /** ISO 639-1 code of the source article. The summary is always English. */
  language?: Maybe<Scalars['String']>;
  malId?: Maybe<Scalars['Int']>;
  publishedDate?: Maybe<Scalars['String']>;
  /** Media the article points at — a PV, the official site, an announcement post. */
  references?: Maybe<Array<NewsReference>>;
  sourceName?: Maybe<Scalars['String']>;
  sourceUrl?: Maybe<Scalars['String']>;
  summary?: Maybe<Scalars['String']>;
  title: Scalars['String'];
};

/**
 * The ways two anime can be connected.
 *
 * Only kinds we can actually establish appear here. One more is wanted and is
 * absent because the data does not support it yet:
 *
 * A shared creator, the thread joining Serial Experiments Lain and Haibane
 * Renmei. That needs staff credited against an anime by role, and anime_staff
 * holds voice actors with no role column and no direct link to an anime.
 */
export enum AnimeRelation {
  /**
   * Another entry in the same series: a season, film, OVA or special sharing
   *   its TheTVDB series id. The same show, not a different one.
   */
  SameSeries = 'SAME_SERIES',
  /**
   * A separate adaptation of the same source work -- Fruits Basket in 2001 and
   *   2019, Hunter x Hunter in 1999 and 2011, Fullmetal Alchemist and
   *   Brotherhood.
   *
   *   A different show, not another entry in one: these are distinct productions,
   *   often years and a studio apart, telling the same story again. They share no
   *   TheTVDB series id and frequently no cast, which is why SAME_SERIES cannot
   *   reach them and why the source work had to be modelled as an identity rather
   *   than the category `source` records.
   */
  SharedSource = 'SHARED_SOURCE'
}

/** Schedule metadata from AnimeSchedule.net */
export type AnimeScheduleInfo = {
  __typename?: 'AnimeScheduleInfo';
  /** Delay status for raw version */
  delayedTimetable?: Maybe<Scalars['String']>;
  /** Delay status for dub version */
  dubDelayedTimetable?: Maybe<Scalars['String']>;
  /** Dub release time */
  dubTime?: Maybe<Scalars['Time']>;
  /** Japanese broadcast time */
  jpnTime?: Maybe<Scalars['Time']>;
  /** Notes (early streaming, delays, etc.) */
  notes?: Maybe<Scalars['String']>;
  /** Delay status for sub version */
  subDelayedTimetable?: Maybe<Scalars['String']>;
  /** Subtitle release time */
  subTime?: Maybe<Scalars['Time']>;
};

export type AnimeSearchInput = {
  /** Anime statuses */
  animeStatuses?: InputMaybe<Array<Scalars['String']>>;
  /** Page number */
  page: Scalars['Int'];
  /** Items per page */
  perPage: Scalars['Int'];
  /** Search query */
  query: Scalars['String'];
  /** Sort by */
  sortBy?: InputMaybe<Scalars['String']>;
  /** Sort direction */
  sortDirection?: InputMaybe<Scalars['String']>;
  /** Studios */
  studios?: InputMaybe<Array<Scalars['String']>>;
  /** Tags */
  tags?: InputMaybe<Array<Scalars['String']>>;
};

export type AnimeSeason = {
  __typename?: 'AnimeSeason';
  /** Anime ID this season belongs to */
  animeId?: Maybe<Scalars['String']>;
  createdAt: Scalars['Time'];
  /** Episode count for this season */
  episodeCount?: Maybe<Scalars['Int']>;
  /** ID of the anime season */
  id: Scalars['ID'];
  /** Additional notes about this season */
  notes?: Maybe<Scalars['String']>;
  /** Season identifier (e.g., SPRING_2024) */
  season: Scalars['Season'];
  /** Status of the anime season */
  status: AnimeSeasonStatus;
  updatedAt: Scalars['Time'];
};

export enum AnimeSeasonStatus {
  Announced = 'ANNOUNCED',
  Cancelled = 'CANCELLED',
  Confirmed = 'CONFIRMED',
  Unknown = 'UNKNOWN'
}

export type AnimeStaff = {
  __typename?: 'AnimeStaff';
  /** The staff member's birthplace (if known) */
  birthPlace?: Maybe<Scalars['String']>;
  /** The staff member's birthdate (if known) */
  birthday?: Maybe<Scalars['String']>;
  /** The staff member's blood type (if known) */
  bloodType?: Maybe<Scalars['String']>;
  /** the characters associated with the staff member */
  characters?: Maybe<Array<AnimeCharacter>>;
  /** Timestamp when the staff member was created in the database */
  createdAt?: Maybe<Scalars['Time']>;
  /** The family name of the staff member */
  familyName: Scalars['String'];
  /** The given name of the staff member */
  givenName: Scalars['String'];
  /** The staff member's hobbies (if known) */
  hobbies?: Maybe<Scalars['String']>;
  /** Unique identifier for the staff member */
  id: Scalars['ID'];
  /** URL or path to the staff member's image */
  image?: Maybe<Scalars['String']>;
  /** Staff Language */
  language?: Maybe<Scalars['String']>;
  /**
   * Every credited role for this staff member, across every anime. Ordered by
   *   the anime's start date, newest first, with undated anime last.
   *
   *   anime_character rows are scoped to a single anime, so one person voicing the
   *   same character across several seasons appears here once per season -- that
   *   is a credit each, not a duplicate.
   */
  roles?: Maybe<Array<StaffRole>>;
  /**
   * Public URL segment for this staff member, e.g. "mary-elizabeth-mcglynn",
   *   derived from their name. Null only where a name reduces to nothing a URL can
   *   carry; callers should fall back to the id.
   */
  slug?: Maybe<Scalars['String']>;
  /** A brief summary of the staff member's background or career */
  summary?: Maybe<Scalars['String']>;
  /** Timestamp when the staff member was last updated in the database */
  updatedAt?: Maybe<Scalars['Time']>;
};

export type ApiInfo = {
  __typename?: 'ApiInfo';
  /** API Info of the AnimeAPI */
  animeApi: AnimeApi;
  /** API Info of the ListServiceAPI */
  golangTemplateAPI: ListServiceApi;
  /** Name of the API */
  name: Scalars['String'];
  /** API Info of the ScraperAPI */
  scraperAPI: ScraperApi;
};

export type ChangePasswordInput = {
  new_password: Scalars['String'];
  old_password: Scalars['String'];
};

export type CharacterWithStaff = {
  __typename?: 'CharacterWithStaff';
  /** The character details */
  character: AnimeCharacter;
  /** The staff member associated with the character */
  staff?: Maybe<Array<AnimeStaff>>;
};

export type CreateUserInput = {
  email?: InputMaybe<Scalars['String']>;
  firstname: Scalars['String'];
  id: Scalars['String'];
  language: Language;
  lastname: Scalars['String'];
  username: Scalars['String'];
};

export type Credentials = {
  __typename?: 'Credentials';
  refresh_token?: Maybe<Scalars['String']>;
  token?: Maybe<Scalars['String']>;
};

export type CurrentlyAiringInput = {
  /** days in the future */
  daysInFuture?: InputMaybe<Scalars['Int']>;
  /** end date */
  endDate?: InputMaybe<Scalars['Time']>;
  /** start date */
  startDate: Scalars['Time'];
};

export type EmailVerificationResult = {
  __typename?: 'EmailVerificationResult';
  success: Scalars['Boolean'];
  userID?: Maybe<Scalars['ID']>;
};

export type Episode = {
  __typename?: 'Episode';
  /** Episode air date */
  airDate?: Maybe<Scalars['Time']>;
  /** Calculated air time with timezone conversion */
  airTime?: Maybe<Scalars['Time']>;
  /** Precise air times by type (raw/sub/dub) with per-type streaming platforms */
  airTimes?: Maybe<Array<EpisodeAirTime>>;
  /** Anime ID of the episode */
  animeId?: Maybe<Scalars['String']>;
  createdAt: Scalars['String'];
  /** Episode number */
  episodeNumber?: Maybe<Scalars['Int']>;
  /** ID of the episode */
  id: Scalars['ID'];
  /** Episode synopsis */
  synopsis?: Maybe<Scalars['String']>;
  /** Episode title */
  titleEn?: Maybe<Scalars['String']>;
  /** Episode title */
  titleJp?: Maybe<Scalars['String']>;
  updatedAt: Scalars['String'];
};

/** Precise air time for an episode by type (raw/sub/dub) */
export type EpisodeAirTime = {
  __typename?: 'EpisodeAirTime';
  /** Precise air datetime from AnimeSchedule */
  airDatetime: Scalars['Time'];
  /** Air type (raw, sub, dub) */
  airType: AirType;
  /** Streaming platforms where this episode is available for this air type */
  streams?: Maybe<Array<StreamingPlatform>>;
};

export type Fanart = {
  __typename?: 'Fanart';
  id: Scalars['ID'];
  imageUrl: Scalars['String'];
  sourceUrl?: Maybe<Scalars['String']>;
};

export type Key = {
  __typename?: 'Key';
  body: Scalars['String'];
  id: Scalars['String'];
};

export enum Language {
  En = 'EN',
  Th = 'TH'
}

export type Link = {
  __typename?: 'Link';
  /** animeid Link */
  animeID: Scalars['String'];
  /** ID of the link */
  id: Scalars['ID'];
  /** name of anime */
  name: Scalars['String'];
  /** season */
  season: Scalars['Int'];
  /** TheTVDB ID */
  thetvdbID: Scalars['String'];
};

export type ListServiceApi = {
  __typename?: 'ListServiceAPI';
  /** Version of event golang-template service */
  version: Scalars['String'];
};

export type LoginInput = {
  password: Scalars['String'];
  username: Scalars['String'];
};

export type MarkChapterInput = {
  chapterNumber: Scalars['Int'];
  readAt?: InputMaybe<Scalars['String']>;
  workID: Scalars['String'];
};

export type MarkEpisodeInput = {
  animeID: Scalars['String'];
  episodeNumber: Scalars['Int'];
  /** Defaults to now. Supplied when backfilling something watched earlier. */
  watchedAt?: InputMaybe<Scalars['String']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  AddAnime: UserAnime;
  AddWork: UserWork;
  CreatUser: User;
  CreateList: UserList;
  CreateSession?: Maybe<SigninResult>;
  DeleteAnime: Scalars['Boolean'];
  DeleteList: Scalars['Boolean'];
  DeleteWork: Scalars['Boolean'];
  Logout: Scalars['Boolean'];
  MarkChapterRead: ReadChapter;
  MarkEpisodeWatched: WatchedEpisode;
  RefreshToken: SigninResult;
  Register: RegisterResult;
  RequestPasswordReset: Scalars['Boolean'];
  ResendVerificationEmail: Scalars['Boolean'];
  ResetPassword: Scalars['Boolean'];
  UnmarkChapterRead: Scalars['Boolean'];
  UnmarkEpisodeWatched: Scalars['Boolean'];
  UpdateAnime: UserAnime;
  UpdateUserDetails: User;
  UpdateWork: UserWork;
  UploadBannerImage: User;
  UploadProfileImage: User;
  /** @deprecated Use VerifyEmailWithUser, which returns the verified user's id for analytics/identity linkage. */
  VerifyEmail: Scalars['Boolean'];
  VerifyEmailWithUser: EmailVerificationResult;
  registerPublicKey?: Maybe<Key>;
  /** Save link */
  saveLink: Link;
};


export type MutationAddAnimeArgs = {
  input: UserAnimeInput;
};


export type MutationAddWorkArgs = {
  input: UserWorkInput;
};


export type MutationCreatUserArgs = {
  input: CreateUserInput;
};


export type MutationCreateListArgs = {
  input: UserListInput;
};


export type MutationCreateSessionArgs = {
  input?: InputMaybe<LoginInput>;
};


export type MutationDeleteAnimeArgs = {
  id: Scalars['ID'];
};


export type MutationDeleteListArgs = {
  id: Scalars['ID'];
};


export type MutationDeleteWorkArgs = {
  id: Scalars['ID'];
};


export type MutationMarkChapterReadArgs = {
  input: MarkChapterInput;
};


export type MutationMarkEpisodeWatchedArgs = {
  input: MarkEpisodeInput;
};


export type MutationRefreshTokenArgs = {
  token: Scalars['String'];
};


export type MutationRegisterArgs = {
  input: RegisterInput;
};


export type MutationRequestPasswordResetArgs = {
  input: RequestPasswordResetInput;
};


export type MutationResendVerificationEmailArgs = {
  username: Scalars['String'];
};


export type MutationResetPasswordArgs = {
  input: ResetPasswordInput;
};


export type MutationUnmarkChapterReadArgs = {
  input: MarkChapterInput;
};


export type MutationUnmarkEpisodeWatchedArgs = {
  input: MarkEpisodeInput;
};


export type MutationUpdateAnimeArgs = {
  input: UserAnimeInput;
};


export type MutationUpdateUserDetailsArgs = {
  input: UpdateUserInput;
};


export type MutationUpdateWorkArgs = {
  input: UserWorkInput;
};


export type MutationUploadBannerImageArgs = {
  image: Scalars['Upload'];
};


export type MutationUploadProfileImageArgs = {
  image: Scalars['Upload'];
};


export type MutationRegisterPublicKeyArgs = {
  publicKey: Scalars['String'];
};


export type MutationSaveLinkArgs = {
  input?: InputMaybe<SaveLinkInput>;
};

/** A page of the site-wide feed. */
export type NewsFeed = {
  __typename?: 'NewsFeed';
  items: Array<AnimeNews>;
  /** Total matching the filters, for pagination. Not the number returned. */
  total: Scalars['Int'];
};

export type NewsReference = {
  __typename?: 'NewsReference';
  /** Coarse bucket derived from the link's host: video, post or site. */
  kind: Scalars['String'];
  title: Scalars['String'];
  url: Scalars['String'];
};

/**
 * The safe subset of a User, for anyone to see.
 *
 * A separate type rather than the whole User, so a public query can never be
 * widened into email, sessions, or language just by selecting more fields. Only
 * what a page header renders is here.
 */
export type PublicUser = {
  __typename?: 'PublicUser';
  accentColor?: Maybe<Scalars['String']>;
  bannerImageUrl?: Maybe<Scalars['String']>;
  bio?: Maybe<Scalars['String']>;
  firstname: Scalars['String'];
  id: Scalars['ID'];
  lastname: Scalars['String'];
  /** Whether the lists section is shown. False means the header stands alone. */
  listsPublic: Scalars['Boolean'];
  profileImageUrl?: Maybe<Scalars['String']>;
  username: Scalars['String'];
};

export type Query = {
  __typename?: 'Query';
  PublicUserAnimeStatusCounts: UserAnimeStatusCounts;
  PublicUserAnimes?: Maybe<UserAnimePaginated>;
  PublicUserWorkStatusCounts: UserWorkStatusCounts;
  PublicUserWorks?: Maybe<UserWorkPaginated>;
  ReadChapters: Array<ReadChapter>;
  UserAnimeStatusCounts: UserAnimeStatusCounts;
  UserAnimes?: Maybe<UserAnimePaginated>;
  UserDetails: User;
  UserLists?: Maybe<Array<UserList>>;
  UserWorkStatusCounts: UserWorkStatusCounts;
  UserWorks?: Maybe<UserWorkPaginated>;
  WatchedEpisodes: Array<WatchedEpisode>;
  /** Get anime by ID */
  anime: Anime;
  /** Get anime by season name and year (more flexible) */
  animeBySeasonAndYear?: Maybe<Array<Anime>>;
  /** Get anime by season and year */
  animeBySeasons?: Maybe<Array<Anime>>;
  /** Look an anime up by its public URL slug. Null when no anime claims it. */
  animeBySlug?: Maybe<Anime>;
  /** AnimeAPI info */
  apiInfo: ApiInfo;
  availabilityByUsername: Scalars['Boolean'];
  /** characters and staff by anime ID */
  charactersAndStaffByAnimeId?: Maybe<Array<CharacterWithStaff>>;
  /** Get currently airing anime */
  currentlyAiring?: Maybe<Array<Anime>>;
  /**
   * Works still being serialised, most widely read first.
   *
   *   The reading counterpart of currentlyAiring, and deliberately ranked by
   *   members rather than by how recently a work started. Popularity takes years
   *   to accumulate, so ranking anything recent by it surfaces only obscurities:
   *   of the works whose first chapter landed in the past year, the most read has
   *   a few thousand members against eighty thousand for the ongoing series people
   *   actually follow.
   *
   *   Ordered by members rather than score because this answers "what is everyone
   *   reading", not "what is best" -- and score is absent on roughly one work in
   *   ten while members never is.
   */
  currentlyPublishingWorks?: Maybe<Array<Work>>;
  /** Search for anime in the database */
  dbSearch?: Maybe<Array<Anime>>;
  /** Get episode by ID */
  episode: Episode;
  /** Get episodes by anime ID */
  episodesByAnimeId?: Maybe<Array<Episode>>;
  /** get episodes from thetvdb */
  getEpisodesFromTheTVDB?: Maybe<Array<TheTvdbEpisode>>;
  /** Saved Links */
  getSavedLinks?: Maybe<Array<Link>>;
  keys: Array<Key>;
  /**
   * Latest news across every anime, newest first.
   *
   *   Paged by offset because the feed is browsed, not streamed, and offsets survive a user
   *   jumping to page 5. Ordering is (publishedDate DESC, id) — id breaks ties because
   *   publishedDate is only a date, so a busy day would otherwise order arbitrarily and a
   *   page boundary could repeat or skip items between requests.
   */
  latestNews: NewsFeed;
  /** Get most popular anime with a response limit */
  mostPopularAnime?: Maybe<Array<Anime>>;
  /** Get newest anime with a response limit */
  newestAnime?: Maybe<Array<Anime>>;
  /** Search thetvdb for anime */
  searchTheTVDB?: Maybe<Array<TheTvdbAnime>>;
  /** Get a staff member (voice actor) by ID. Null when no staff member has that id. */
  staff?: Maybe<AnimeStaff>;
  /** Look a staff member up by their public URL slug. Null when no one claims it. */
  staffBySlug?: Maybe<AnimeStaff>;
  /** Sync all thetvdb IDs from links to anime table */
  syncIDs: Scalars['Boolean'];
  /** sync thetvdb */
  syncLink: Scalars['Boolean'];
  /** Get top rated anime with a response limit */
  topRatedAnime?: Maybe<Array<Anime>>;
  /**
   * A user's public page, by username. Null when no such user. Never exposes
   *   email, sessions, or anything the header does not show.
   */
  userByUsername?: Maybe<PublicUser>;
  /**
   * Look a source work up by its public URL slug -- the manga, light novel or
   *   novel behind /manga/<slug>. Null when no work claims it.
   *
   *   One query for the whole family rather than one per type, because they are
   *   one table discriminated by `type`, exactly as MyAnimeList serves them from
   *   a single namespace.
   */
  workBySlug?: Maybe<Work>;
  /**
   * Works of one kind, paged -- the browse pages behind /manga and
   *   /light-novels.
   *
   *   Separate from currentlyPublishingWorks rather than an argument on it: that
   *   one answers "what is running now" and is deliberately capped at a row's
   *   worth, while this one walks the whole shelf and has to page.
   */
  works: WorkPage;
};


export type QueryPublicUserAnimeStatusCountsArgs = {
  userID: Scalars['String'];
};


export type QueryPublicUserAnimesArgs = {
  input: UserAnimesInput;
  userID: Scalars['String'];
};


export type QueryPublicUserWorkStatusCountsArgs = {
  userID: Scalars['String'];
};


export type QueryPublicUserWorksArgs = {
  input: UserWorksInput;
  userID: Scalars['String'];
};


export type QueryReadChaptersArgs = {
  workID: Scalars['String'];
};


export type QueryUserAnimesArgs = {
  input: UserAnimesInput;
};


export type QueryUserWorksArgs = {
  input: UserWorksInput;
};


export type QueryWatchedEpisodesArgs = {
  animeID: Scalars['String'];
};


export type QueryAnimeArgs = {
  id: Scalars['ID'];
};


export type QueryAnimeBySeasonAndYearArgs = {
  limit?: InputMaybe<Scalars['Int']>;
  seasonName: Scalars['String'];
  year: Scalars['Int'];
};


export type QueryAnimeBySeasonsArgs = {
  limit?: InputMaybe<Scalars['Int']>;
  season: Scalars['Season'];
};


export type QueryAnimeBySlugArgs = {
  slug: Scalars['String'];
};


export type QueryAvailabilityByUsernameArgs = {
  username: Scalars['String'];
};


export type QueryCharactersAndStaffByAnimeIdArgs = {
  animeId: Scalars['ID'];
};


export type QueryCurrentlyAiringArgs = {
  input?: InputMaybe<CurrentlyAiringInput>;
  limit?: InputMaybe<Scalars['Int']>;
};


export type QueryCurrentlyPublishingWorksArgs = {
  limit?: InputMaybe<Scalars['Int']>;
};


export type QueryDbSearchArgs = {
  searchQuery: AnimeSearchInput;
};


export type QueryEpisodeArgs = {
  id: Scalars['ID'];
};


export type QueryEpisodesByAnimeIdArgs = {
  animeId: Scalars['ID'];
};


export type QueryGetEpisodesFromTheTvdbArgs = {
  thetvdbID: Scalars['String'];
};


export type QueryLatestNewsArgs = {
  category?: InputMaybe<Scalars['String']>;
  language?: InputMaybe<Scalars['String']>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
};


export type QueryMostPopularAnimeArgs = {
  limit?: InputMaybe<Scalars['Int']>;
};


export type QueryNewestAnimeArgs = {
  limit?: InputMaybe<Scalars['Int']>;
};


export type QuerySearchTheTvdbArgs = {
  input?: InputMaybe<TheTvdbSearchInput>;
};


export type QueryStaffArgs = {
  id: Scalars['ID'];
};


export type QueryStaffBySlugArgs = {
  slug: Scalars['String'];
};


export type QuerySyncLinkArgs = {
  linkID: Scalars['String'];
};


export type QueryTopRatedAnimeArgs = {
  limit?: InputMaybe<Scalars['Int']>;
};


export type QueryUserByUsernameArgs = {
  username: Scalars['String'];
};


export type QueryWorkBySlugArgs = {
  slug: Scalars['String'];
};


export type QueryWorksArgs = {
  input: WorksInput;
};

/** One chapter a reader has finished. Numbered, because works have no chapter records at all. */
export type ReadChapter = {
  __typename?: 'ReadChapter';
  chapterNumber: Scalars['Int'];
  id: Scalars['ID'];
  readAt?: Maybe<Scalars['String']>;
  workID: Scalars['String'];
};

export type RegisterInput = {
  password: Scalars['String'];
  username: Scalars['String'];
};

export type RegisterResult = {
  __typename?: 'RegisterResult';
  id: Scalars['String'];
};

/** One anime connected to another, and how. */
export type RelatedAnime = {
  __typename?: 'RelatedAnime';
  /** The connected anime */
  anime: Anime;
  /** How it is connected */
  relation: AnimeRelation;
};

export type RequestPasswordResetInput = {
  email: Scalars['String'];
  username: Scalars['String'];
};

export type ResetPasswordInput = {
  newPassword: Scalars['String'];
  token: Scalars['String'];
  username: Scalars['String'];
};

export type SaveLinkInput = {
  /** Animeid Link to save */
  animeID: Scalars['String'];
  /** Name of anime */
  name: Scalars['String'];
  /** season */
  season: Scalars['Int'];
  /** TheTVDB ID */
  thetvdbID: Scalars['String'];
};

export type ScraperApi = {
  __typename?: 'ScraperAPI';
  /** Version of event scraper-api service */
  version: Scalars['String'];
};

export type Session = {
  __typename?: 'Session';
  access_token: Scalars['String'];
  refresh_token: Scalars['String'];
};

export type SessionDetails = {
  __typename?: 'SessionDetails';
  id: Scalars['String'];
  ip_address: Scalars['String'];
  token: Scalars['String'];
  user_agent: Scalars['String'];
  user_id: Scalars['String'];
};

export type SigninResult = {
  __typename?: 'SigninResult';
  Credentials: Credentials;
  id: Scalars['ID'];
};

/** One credit: a character a staff member played, and the anime they played it in. */
export type StaffRole = {
  __typename?: 'StaffRole';
  /**
   * The anime the character belongs to. Null when the character outlived its
   *   anime row -- character deletes are not cascaded from the anime side.
   */
  anime?: Maybe<Anime>;
  /** The character performed */
  character: AnimeCharacter;
};

export enum Status {
  Completed = 'COMPLETED',
  Dropped = 'DROPPED',
  Onhold = 'ONHOLD',
  Plantowatch = 'PLANTOWATCH',
  Watching = 'WATCHING'
}

/** Streaming platform where an anime is available */
export type StreamingPlatform = {
  __typename?: 'StreamingPlatform';
  /** Display name of the platform */
  name?: Maybe<Scalars['String']>;
  /** Platform identifier (e.g., crunchyroll, netflix) */
  platform: Scalars['String'];
  /** URL to watch on this platform */
  url: Scalars['String'];
};

export type TheTvdbAnime = {
  __typename?: 'TheTVDBAnime';
  /** Genres */
  genres?: Maybe<Array<Scalars['String']>>;
  /** ID of the anime */
  id: Scalars['ID'];
  /** Anime Poster */
  image?: Maybe<Scalars['String']>;
  /** Anime Link */
  link: Scalars['String'];
  /** studios */
  studios?: Maybe<Array<Scalars['String']>>;
  /** Anime title */
  title: Scalars['String'];
  /** Translations */
  translations?: Maybe<Array<Maybe<TranslationTuple>>>;
  /** Anime Release Year */
  year?: Maybe<Scalars['String']>;
};

export type TheTvdbEpisode = {
  __typename?: 'TheTVDBEpisode';
  /** Episode Air Date */
  airDate?: Maybe<Scalars['String']>;
  /** Episode Description */
  description?: Maybe<Scalars['String']>;
  /** Episode Number */
  episodeNumber: Scalars['Int'];
  /** ID of the episode */
  id: Scalars['ID'];
  /** Episode Image */
  image?: Maybe<Scalars['String']>;
  /** Episode Link */
  link: Scalars['String'];
  /** Season Number */
  seasonNumber: Scalars['Int'];
  /** Episode Title */
  title: Scalars['String'];
};

export type TheTvdbSearchInput = {
  /** Search query */
  query: Scalars['String'];
};

export type TranslationTuple = {
  __typename?: 'TranslationTuple';
  key?: Maybe<Scalars['String']>;
  value?: Maybe<Scalars['String']>;
};

export type UpdateUserInput = {
  accentColor?: InputMaybe<Scalars['String']>;
  bio?: InputMaybe<Scalars['String']>;
  email?: InputMaybe<Scalars['String']>;
  firstname?: InputMaybe<Scalars['String']>;
  language?: InputMaybe<Language>;
  lastname?: InputMaybe<Scalars['String']>;
  listsPublic?: InputMaybe<Scalars['Boolean']>;
  profileImageUrl?: InputMaybe<Scalars['String']>;
  username?: InputMaybe<Scalars['String']>;
};

export type User = {
  __typename?: 'User';
  /** A palette token name that themes the page, e.g. "violet". */
  accentColor?: Maybe<Scalars['String']>;
  active_sessions: Array<SessionDetails>;
  /** The wide header image behind the profile. */
  bannerImageUrl?: Maybe<Scalars['String']>;
  /** A short line the user writes about themselves. */
  bio?: Maybe<Scalars['String']>;
  email?: Maybe<Scalars['String']>;
  firstname: Scalars['String'];
  id: Scalars['ID'];
  language: Language;
  lastname: Scalars['String'];
  /** Whether this user's watch and read lists are shown on their public page. */
  listsPublic: Scalars['Boolean'];
  profileImageUrl?: Maybe<Scalars['String']>;
  username: Scalars['String'];
};

export type UserAnime = {
  __typename?: 'UserAnime';
  anime?: Maybe<Anime>;
  animeID: Scalars['String'];
  createdAt?: Maybe<Scalars['String']>;
  deletedAt?: Maybe<Scalars['String']>;
  episodes?: Maybe<Scalars['Int']>;
  id: Scalars['ID'];
  listID?: Maybe<Scalars['String']>;
  rewatching?: Maybe<Scalars['Int']>;
  rewatchingEpisodes?: Maybe<Scalars['Int']>;
  score?: Maybe<Scalars['Float']>;
  status?: Maybe<Status>;
  tags?: Maybe<Array<Scalars['String']>>;
  updatedAt?: Maybe<Scalars['String']>;
  userID: Scalars['String'];
};

export type UserAnimeInput = {
  animeID: Scalars['String'];
  episodes?: InputMaybe<Scalars['Int']>;
  id?: InputMaybe<Scalars['String']>;
  listID?: InputMaybe<Scalars['String']>;
  rewatching?: InputMaybe<Scalars['Int']>;
  rewatchingEpisodes?: InputMaybe<Scalars['Int']>;
  score?: InputMaybe<Scalars['Float']>;
  status?: InputMaybe<Status>;
  tags?: InputMaybe<Array<Scalars['String']>>;
};

export type UserAnimePaginated = {
  __typename?: 'UserAnimePaginated';
  animes: Array<UserAnime>;
  limit: Scalars['Int'];
  page: Scalars['Int'];
  total: Scalars['Int64'];
};

/**
 * How many anime the viewer has in each status.
 *
 * One field per status rather than a list of (status, count) pairs: the set is
 * fixed and small, and named fields let a client read watching or completed
 * directly instead of scanning for it. A status with no entries is a real zero,
 * not an absent row -- the resolver fills every field so a tab can always show a
 * number.
 */
export type UserAnimeStatusCounts = {
  __typename?: 'UserAnimeStatusCounts';
  completed: Scalars['Int64'];
  dropped: Scalars['Int64'];
  onHold: Scalars['Int64'];
  planToWatch: Scalars['Int64'];
  watching: Scalars['Int64'];
};

export type UserAnimesInput = {
  limit: Scalars['Int'];
  page: Scalars['Int'];
  status?: InputMaybe<Status>;
};

export type UserList = {
  __typename?: 'UserList';
  createdAt?: Maybe<Scalars['String']>;
  deletedAt?: Maybe<Scalars['String']>;
  description?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  isPublic?: Maybe<Scalars['Boolean']>;
  name: Scalars['String'];
  tags?: Maybe<Array<Scalars['String']>>;
  type?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['String']>;
  userID: Scalars['String'];
};

export type UserListInput = {
  description?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['String']>;
  isPublic?: InputMaybe<Scalars['Boolean']>;
  name: Scalars['String'];
  tags?: InputMaybe<Array<Scalars['String']>>;
  type?: InputMaybe<Scalars['String']>;
};

/**
 * A work on a reader's shelf.
 *
 * Deliberately parallel to UserAnime -- same job, different medium -- so a client
 * can render both through one card. Progress differs because a manga release is
 * counted in chapters and volumes, not episodes.
 */
export type UserWork = {
  __typename?: 'UserWork';
  chapters?: Maybe<Scalars['Int']>;
  createdAt?: Maybe<Scalars['String']>;
  deletedAt?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  listID?: Maybe<Scalars['String']>;
  score?: Maybe<Scalars['Float']>;
  status?: Maybe<WorkStatus>;
  tags?: Maybe<Array<Scalars['String']>>;
  updatedAt?: Maybe<Scalars['String']>;
  userID: Scalars['String'];
  volumes?: Maybe<Scalars['Int']>;
  work?: Maybe<Work>;
  workID: Scalars['String'];
};

export type UserWorkInput = {
  chapters?: InputMaybe<Scalars['Int']>;
  id?: InputMaybe<Scalars['String']>;
  listID?: InputMaybe<Scalars['String']>;
  score?: InputMaybe<Scalars['Float']>;
  status?: InputMaybe<WorkStatus>;
  tags?: InputMaybe<Array<Scalars['String']>>;
  volumes?: InputMaybe<Scalars['Int']>;
  workID: Scalars['String'];
};

export type UserWorkPaginated = {
  __typename?: 'UserWorkPaginated';
  limit: Scalars['Int'];
  page: Scalars['Int'];
  total: Scalars['Int64'];
  works: Array<UserWork>;
};

/** The reading counterpart of UserAnimeStatusCounts. */
export type UserWorkStatusCounts = {
  __typename?: 'UserWorkStatusCounts';
  completed: Scalars['Int64'];
  dropped: Scalars['Int64'];
  onHold: Scalars['Int64'];
  planToRead: Scalars['Int64'];
  reading: Scalars['Int64'];
};

export type UserWorksInput = {
  limit: Scalars['Int'];
  page: Scalars['Int'];
  status?: InputMaybe<WorkStatus>;
};

/**
 * One episode a viewer has finished.
 *
 * Identified by number rather than by the episode record's id: the scraper
 * sometimes clears an anime's episodes and reinserts them with new ids, and
 * history pointing at those would be lost on every re-scrape.
 */
export type WatchedEpisode = {
  __typename?: 'WatchedEpisode';
  animeID: Scalars['String'];
  episodeNumber: Scalars['Int'];
  id: Scalars['ID'];
  watchedAt?: Maybe<Scalars['String']>;
};

/**
 * A source work: the manga, light novel or novel an anime is adapted from.
 *
 * One type for the whole family, discriminated by `type`. MyAnimeList serves them
 * from a single namespace at /manga/<id> and their fields are identical apart from
 * demographic, so splitting them into separate types would mean near-copies and a
 * caller having to guess which to ask for.
 *
 * The public URL follows the same reasoning: /manga/<slug> for all of them, with
 * the type shown on the page. `type` is data that can be corrected upstream, and a
 * URL that moved when a work was reclassified would break every link to it.
 */
export type Work = {
  __typename?: 'Work';
  /**
   * Every anime adapted from this work, oldest first.
   *
   *   This is the point of modelling works at all: Fruits Basket in 2001 and 2019,
   *   Hunter x Hunter in 1999 and 2011. Those share no TheTVDB series id and often
   *   no cast, so nothing else relates them to each other.
   *
   *   Usually empty, and increasingly so. MyAnimeList holds over sixty thousand
   *   manga against roughly ten thousand anime adapted from one, so most works
   *   have never been adapted and never will be. Empty is the ordinary case here,
   *   not a missing relation -- a page rendering this needs a real empty state
   *   rather than an apology.
   */
  adaptations?: Maybe<Array<Anime>>;
  /** Credited authors, surname first as the source writes them. */
  authors?: Maybe<Array<Scalars['String']>>;
  chapters?: Maybe<Scalars['Int']>;
  createdAt: Scalars['String'];
  /** Target readership -- Shounen, Seinen, Josei. Absent on light novels. */
  demographic?: Maybe<Scalars['String']>;
  favorites?: Maybe<Scalars['Int']>;
  id: Scalars['ID'];
  imageUrl?: Maybe<Scalars['String']>;
  /** MyAnimeList's id for this work. Null for works from any other source. */
  malId?: Maybe<Scalars['Int']>;
  members?: Maybe<Scalars['Int']>;
  publishedFrom?: Maybe<Scalars['String']>;
  publishedTo?: Maybe<Scalars['String']>;
  ranking?: Maybe<Scalars['Int']>;
  score?: Maybe<Scalars['Float']>;
  /** The magazine it ran in, when it ran in one. */
  serialization?: Maybe<Scalars['String']>;
  /** Publication status as the source reports it. */
  status?: Maybe<Scalars['String']>;
  synopsis?: Maybe<Scalars['String']>;
  titleEn?: Maybe<Scalars['String']>;
  titleJp?: Maybe<Scalars['String']>;
  titleSynonyms?: Maybe<Array<Scalars['String']>>;
  /**
   * Which kind of work this is: MANGA, LIGHT_NOVEL, NOVEL, WEB_MANGA,
   *   WEB_NOVEL, ONE_SHOT, DOUJINSHI, MANHWA, MANHUA or FOUR_KOMA.
   *
   *   A plain string rather than an enum: MyAnimeList adds labels without warning,
   *   and an unrecognised one should render as itself rather than fail the query.
   */
  type: Scalars['String'];
  updatedAt: Scalars['String'];
  /** Public URL segment. Assigned once and never rewritten. */
  urlSlug?: Maybe<Scalars['String']>;
  userWork?: Maybe<UserWork>;
  volumes?: Maybe<Scalars['Int']>;
};


/**
 * A source work: the manga, light novel or novel an anime is adapted from.
 *
 * One type for the whole family, discriminated by `type`. MyAnimeList serves them
 * from a single namespace at /manga/<id> and their fields are identical apart from
 * demographic, so splitting them into separate types would mean near-copies and a
 * caller having to guess which to ask for.
 *
 * The public URL follows the same reasoning: /manga/<slug> for all of them, with
 * the type shown on the page. `type` is data that can be corrected upstream, and a
 * URL that moved when a work was reclassified would break every link to it.
 */
export type WorkAdaptationsArgs = {
  limit?: InputMaybe<Scalars['Int']>;
};

/**
 * One page of works, with the total so a caller can render pagination.
 *
 * `total` is the count for the whole type, not for the page -- the number the
 * page needs to say "1 of 2,219".
 */
export type WorkPage = {
  __typename?: 'WorkPage';
  page: Scalars['Int'];
  perPage: Scalars['Int'];
  total: Scalars['Int'];
  works: Array<Work>;
};

/**
 * Reading statuses. Its own enum rather than reusing Status: watching a manga is
 * not a thing, and one shared enum would force every client to translate WATCHING
 * into "Reading" on some screens and not others.
 */
export enum WorkStatus {
  Completed = 'COMPLETED',
  Dropped = 'DROPPED',
  Onhold = 'ONHOLD',
  Plantoread = 'PLANTOREAD',
  Reading = 'READING'
}

/**
 * A page of works of one kind -- what /manga and /light-novels browse.
 *
 * Paged rather than limited, unlike every other work query here. The reading row
 * on the homepage answers "what should I pick up", which twelve rows satisfy;
 * these pages answer "show me everything", and the manga shelf alone is 53,000
 * entries. A caller that cannot ask for page 40 cannot render the page at all.
 */
export type WorksInput = {
  /**
   * Kinds to leave out, applied after `types`.
   *
   *   This is how a caller says "everything else". Spelling that as an inclusive
   *   list of the other seven kinds would quietly drop rows the day MyAnimeList
   *   invents an eighth -- and the page that means "everything else" is exactly
   *   the one that should absorb it. Exclusion keeps that true without a deploy.
   */
  excludeTypes?: InputMaybe<Array<Scalars['String']>>;
  /** Zero-based, matching AnimeSearchInput. */
  page?: InputMaybe<Scalars['Int']>;
  /** Defaults to 24, capped at 100. */
  perPage?: InputMaybe<Scalars['Int']>;
  /**
   * POPULARITY (members, the default), SCORE, NEWEST or TITLE.
   *
   *   Popularity leads because it is the only one of the four that every row has.
   *   Score is absent on roughly one work in ten and publishedFrom on more than
   *   that, so sorting by either silently buries whatever the scraper has not
   *   filled in yet.
   */
  sortBy?: InputMaybe<Scalars['String']>;
  /**
   * Which kinds to list: MANGA, LIGHT_NOVEL, MANHWA and so on. Strings for the
   *   same reason Work.type is one -- MyAnimeList adds labels without warning.
   *
   *   A list rather than one kind because the shelves readers actually want are
   *   groups: light novels and novels are one shelf to a reader even though the
   *   scraper tells them apart. Omit it to mean every kind.
   */
  types?: InputMaybe<Array<Scalars['String']>>;
};

export type GetHomePageDataQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']>;
}>;


export type GetHomePageDataQuery = { __typename?: 'Query', topRatedAnime?: Array<{ __typename?: 'Anime', id: string, anidbid?: string | null, thetvdbid?: string | null, slug?: string | null, titleEn?: string | null, titleJp?: string | null, imageUrl?: string | null, duration?: string | null, tags?: Array<string> | null, description?: string | null, episodeCount?: number | null, animeStatus?: string | null, rating?: string | null, startDate?: any | null, ranking?: number | null, userAnime?: { __typename?: 'UserAnime', id: string, status?: Status | null, score?: number | null, episodes?: number | null } | null }> | null };

export type GetSeasonalAnimeQueryVariables = Exact<{
  season: Scalars['Season'];
  limit?: InputMaybe<Scalars['Int']>;
}>;


export type GetSeasonalAnimeQuery = { __typename?: 'Query', animeBySeasons?: Array<{ __typename?: 'Anime', id: string, anidbid?: string | null, thetvdbid?: string | null, slug?: string | null, titleEn?: string | null, titleJp?: string | null, imageUrl?: string | null, duration?: string | null, tags?: Array<string> | null, description?: string | null, episodeCount?: number | null, animeStatus?: string | null, rating?: string | null, startDate?: any | null, ranking?: number | null, userAnime?: { __typename?: 'UserAnime', id: string, status?: Status | null, score?: number | null, episodes?: number | null } | null }> | null };

export type GetAnimeDetailsByIdQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type GetAnimeDetailsByIdQuery = { __typename?: 'Query', anime: { __typename?: 'Anime', id: string, anidbid?: string | null, thetvdbid?: string | null, malId?: number | null, slug?: string | null, titleEn?: string | null, titleJp?: string | null, titleRomaji?: string | null, titleKanji?: string | null, titleSynonyms?: Array<string> | null, description?: string | null, imageUrl?: string | null, tags?: Array<string> | null, studios?: Array<string> | null, animeStatus?: string | null, episodeCount?: number | null, seasonNumber?: number | null, type?: string | null, duration?: string | null, rating?: string | null, startDate?: any | null, endDate?: any | null, broadcast?: string | null, source?: string | null, licensors?: Array<string> | null, ranking?: number | null, createdAt: string, updatedAt: string, sourceWork?: { __typename?: 'Work', id: string, urlSlug?: string | null, titleEn?: string | null, titleJp?: string | null, type: string } | null, episodes?: Array<{ __typename?: 'Episode', id: string, animeId?: string | null, episodeNumber?: number | null, titleEn?: string | null, titleJp?: string | null, synopsis?: string | null, airDate?: any | null, createdAt: string, updatedAt: string }> | null, relatedAnime?: Array<{ __typename?: 'RelatedAnime', relation: AnimeRelation, anime: { __typename?: 'Anime', id: string, slug?: string | null, titleEn?: string | null, titleJp?: string | null, imageUrl?: string | null, type?: string | null, startDate?: any | null, animeStatus?: string | null } }> | null, scheduleInfo?: { __typename?: 'AnimeScheduleInfo', jpnTime?: any | null, subTime?: any | null, dubTime?: any | null, notes?: string | null, delayedTimetable?: string | null, subDelayedTimetable?: string | null, dubDelayedTimetable?: string | null } | null, streamingPlatforms?: Array<{ __typename?: 'StreamingPlatform', platform: string, name?: string | null, url: string }> | null, news?: Array<{ __typename?: 'AnimeNews', id: string, title: string, summary?: string | null, category: string, sourceUrl?: string | null, sourceName?: string | null, publishedDate?: string | null, episodeNumber?: number | null, language?: string | null, references?: Array<{ __typename?: 'NewsReference', kind: string, title: string, url: string }> | null }> | null, userAnime?: { __typename?: 'UserAnime', id: string, status?: Status | null, score?: number | null, episodes?: number | null } | null } };

export type GetAnimeSlugByIdQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type GetAnimeSlugByIdQuery = { __typename?: 'Query', anime: { __typename?: 'Anime', id: string, slug?: string | null } };

export type GetAnimeDetailsBySlugQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type GetAnimeDetailsBySlugQuery = { __typename?: 'Query', animeBySlug?: { __typename?: 'Anime', id: string, anidbid?: string | null, thetvdbid?: string | null, malId?: number | null, slug?: string | null, titleEn?: string | null, titleJp?: string | null, titleRomaji?: string | null, titleKanji?: string | null, titleSynonyms?: Array<string> | null, description?: string | null, imageUrl?: string | null, tags?: Array<string> | null, studios?: Array<string> | null, animeStatus?: string | null, episodeCount?: number | null, seasonNumber?: number | null, type?: string | null, duration?: string | null, rating?: string | null, startDate?: any | null, endDate?: any | null, broadcast?: string | null, source?: string | null, licensors?: Array<string> | null, ranking?: number | null, createdAt: string, updatedAt: string, sourceWork?: { __typename?: 'Work', id: string, urlSlug?: string | null, titleEn?: string | null, titleJp?: string | null, type: string } | null, episodes?: Array<{ __typename?: 'Episode', id: string, animeId?: string | null, episodeNumber?: number | null, titleEn?: string | null, titleJp?: string | null, synopsis?: string | null, airDate?: any | null, createdAt: string, updatedAt: string }> | null, relatedAnime?: Array<{ __typename?: 'RelatedAnime', relation: AnimeRelation, anime: { __typename?: 'Anime', id: string, slug?: string | null, titleEn?: string | null, titleJp?: string | null, imageUrl?: string | null, type?: string | null, startDate?: any | null, animeStatus?: string | null } }> | null, scheduleInfo?: { __typename?: 'AnimeScheduleInfo', jpnTime?: any | null, subTime?: any | null, dubTime?: any | null, notes?: string | null, delayedTimetable?: string | null, subDelayedTimetable?: string | null, dubDelayedTimetable?: string | null } | null, streamingPlatforms?: Array<{ __typename?: 'StreamingPlatform', platform: string, name?: string | null, url: string }> | null, news?: Array<{ __typename?: 'AnimeNews', id: string, title: string, summary?: string | null, category: string, sourceUrl?: string | null, sourceName?: string | null, publishedDate?: string | null, episodeNumber?: number | null, language?: string | null, references?: Array<{ __typename?: 'NewsReference', kind: string, title: string, url: string }> | null }> | null, userAnime?: { __typename?: 'UserAnime', id: string, status?: Status | null, score?: number | null, episodes?: number | null } | null } | null };

export type GetCurrentlyPublishingWorksQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']>;
}>;


export type GetCurrentlyPublishingWorksQuery = { __typename?: 'Query', currentlyPublishingWorks?: Array<{ __typename?: 'Work', id: string, urlSlug?: string | null, titleEn?: string | null, titleJp?: string | null, type: string, score?: number | null, publishedFrom?: string | null }> | null };

export type GetWorksOverviewQueryVariables = Exact<{
  popular: WorksInput;
  rated: WorksInput;
  newest: WorksInput;
}>;


export type GetWorksOverviewQuery = { __typename?: 'Query', popular: { __typename?: 'WorkPage', total: number, works: Array<{ __typename?: 'Work', id: string, urlSlug?: string | null, titleEn?: string | null, titleJp?: string | null, type: string, status?: string | null, score?: number | null, members?: number | null, publishedFrom?: string | null }> }, rated: { __typename?: 'WorkPage', total: number, works: Array<{ __typename?: 'Work', id: string, urlSlug?: string | null, titleEn?: string | null, titleJp?: string | null, type: string, status?: string | null, score?: number | null, members?: number | null, publishedFrom?: string | null }> }, newest: { __typename?: 'WorkPage', total: number, works: Array<{ __typename?: 'Work', id: string, urlSlug?: string | null, titleEn?: string | null, titleJp?: string | null, type: string, status?: string | null, score?: number | null, members?: number | null, publishedFrom?: string | null }> } };

export type GetWorksByTypeQueryVariables = Exact<{
  input: WorksInput;
}>;


export type GetWorksByTypeQuery = { __typename?: 'Query', works: { __typename?: 'WorkPage', total: number, page: number, perPage: number, works: Array<{ __typename?: 'Work', id: string, urlSlug?: string | null, titleEn?: string | null, titleJp?: string | null, type: string, status?: string | null, score?: number | null, members?: number | null, publishedFrom?: string | null }> } };

export type GetWorkBySlugQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type GetWorkBySlugQuery = { __typename?: 'Query', workBySlug?: { __typename?: 'Work', id: string, malId?: number | null, type: string, urlSlug?: string | null, titleEn?: string | null, titleJp?: string | null, titleSynonyms?: Array<string> | null, synopsis?: string | null, imageUrl?: string | null, status?: string | null, volumes?: number | null, chapters?: number | null, publishedFrom?: string | null, publishedTo?: string | null, demographic?: string | null, serialization?: string | null, authors?: Array<string> | null, score?: number | null, ranking?: number | null, userWork?: { __typename?: 'UserWork', id: string, status?: WorkStatus | null, score?: number | null, chapters?: number | null, volumes?: number | null } | null, adaptations?: Array<{ __typename?: 'Anime', id: string, slug?: string | null, titleEn?: string | null, titleJp?: string | null, imageUrl?: string | null, startDate?: any | null, rating?: string | null, animeStatus?: string | null, episodeCount?: number | null, tags?: Array<string> | null }> | null } | null };

export type UserWorksQueryVariables = Exact<{
  input: UserWorksInput;
}>;


export type UserWorksQuery = { __typename?: 'Query', UserWorks?: { __typename?: 'UserWorkPaginated', page: number, limit: number, total: any, works: Array<{ __typename?: 'UserWork', id: string, userID: string, workID: string, status?: WorkStatus | null, score?: number | null, chapters?: number | null, volumes?: number | null, createdAt?: string | null, updatedAt?: string | null, work?: { __typename?: 'Work', id: string, urlSlug?: string | null, titleEn?: string | null, titleJp?: string | null, type: string, imageUrl?: string | null, status?: string | null, chapters?: number | null, volumes?: number | null, score?: number | null, publishedFrom?: string | null } | null }> } | null };

export type UserWorkStatusCountsQueryVariables = Exact<{ [key: string]: never; }>;


export type UserWorkStatusCountsQuery = { __typename?: 'Query', UserWorkStatusCounts: { __typename?: 'UserWorkStatusCounts', reading: any, planToRead: any, completed: any, onHold: any, dropped: any } };

export type UserAnimeStatusCountsQueryVariables = Exact<{ [key: string]: never; }>;


export type UserAnimeStatusCountsQuery = { __typename?: 'Query', UserAnimeStatusCounts: { __typename?: 'UserAnimeStatusCounts', watching: any, planToWatch: any, completed: any, onHold: any, dropped: any } };

export type AddWorkMutationVariables = Exact<{
  input: UserWorkInput;
}>;


export type AddWorkMutation = { __typename?: 'Mutation', AddWork: { __typename?: 'UserWork', id: string, status?: WorkStatus | null, chapters?: number | null, volumes?: number | null, score?: number | null } };

export type UpdateWorkMutationVariables = Exact<{
  input: UserWorkInput;
}>;


export type UpdateWorkMutation = { __typename?: 'Mutation', UpdateWork: { __typename?: 'UserWork', id: string, status?: WorkStatus | null, chapters?: number | null, volumes?: number | null, score?: number | null } };

export type DeleteWorkMutationVariables = Exact<{
  input: Scalars['ID'];
}>;


export type DeleteWorkMutation = { __typename?: 'Mutation', DeleteWork: boolean };

export type WatchedEpisodesQueryVariables = Exact<{
  animeID: Scalars['String'];
}>;


export type WatchedEpisodesQuery = { __typename?: 'Query', WatchedEpisodes: Array<{ __typename?: 'WatchedEpisode', id: string, episodeNumber: number, watchedAt?: string | null }> };

export type MarkEpisodeWatchedMutationVariables = Exact<{
  input: MarkEpisodeInput;
}>;


export type MarkEpisodeWatchedMutation = { __typename?: 'Mutation', MarkEpisodeWatched: { __typename?: 'WatchedEpisode', id: string, episodeNumber: number } };

export type UnmarkEpisodeWatchedMutationVariables = Exact<{
  input: MarkEpisodeInput;
}>;


export type UnmarkEpisodeWatchedMutation = { __typename?: 'Mutation', UnmarkEpisodeWatched: boolean };

export type ReadChaptersQueryVariables = Exact<{
  workID: Scalars['String'];
}>;


export type ReadChaptersQuery = { __typename?: 'Query', ReadChapters: Array<{ __typename?: 'ReadChapter', id: string, chapterNumber: number, readAt?: string | null }> };

export type MarkChapterReadMutationVariables = Exact<{
  input: MarkChapterInput;
}>;


export type MarkChapterReadMutation = { __typename?: 'Mutation', MarkChapterRead: { __typename?: 'ReadChapter', id: string, chapterNumber: number } };

export type UnmarkChapterReadMutationVariables = Exact<{
  input: MarkChapterInput;
}>;


export type UnmarkChapterReadMutation = { __typename?: 'Mutation', UnmarkChapterRead: boolean };

export type GetAnimeNewsByIdQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type GetAnimeNewsByIdQuery = { __typename?: 'Query', anime: { __typename?: 'Anime', id: string, slug?: string | null, titleEn?: string | null, titleJp?: string | null, imageUrl?: string | null, startDate?: any | null, studios?: Array<string> | null, tags?: Array<string> | null, news?: Array<{ __typename?: 'AnimeNews', id: string, title: string, summary?: string | null, category: string, sourceUrl?: string | null, sourceName?: string | null, publishedDate?: string | null, episodeNumber?: number | null, language?: string | null, references?: Array<{ __typename?: 'NewsReference', kind: string, title: string, url: string }> | null }> | null } };

export type GetAnimeNewsBySlugQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type GetAnimeNewsBySlugQuery = { __typename?: 'Query', animeBySlug?: { __typename?: 'Anime', id: string, slug?: string | null, titleEn?: string | null, titleJp?: string | null, imageUrl?: string | null, startDate?: any | null, studios?: Array<string> | null, tags?: Array<string> | null, news?: Array<{ __typename?: 'AnimeNews', id: string, title: string, summary?: string | null, category: string, sourceUrl?: string | null, sourceName?: string | null, publishedDate?: string | null, episodeNumber?: number | null, language?: string | null, references?: Array<{ __typename?: 'NewsReference', kind: string, title: string, url: string }> | null }> | null } | null };

export type CurrentlyAiringQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']>;
}>;


export type CurrentlyAiringQuery = { __typename?: 'Query', currentlyAiring?: Array<{ __typename?: 'Anime', id: string, slug?: string | null, titleEn?: string | null, titleJp?: string | null, anidbid?: string | null, endDate?: any | null, startDate?: any | null, imageUrl?: string | null, duration?: string | null, ranking?: number | null, broadcast?: string | null, thetvdbid?: string | null, tags?: Array<string> | null, description?: string | null, nextEpisode?: { __typename?: 'Episode', id: string, animeId?: string | null, episodeNumber?: number | null, titleEn?: string | null, titleJp?: string | null, synopsis?: string | null, airDate?: any | null, airTime?: any | null, createdAt: string, updatedAt: string } | null, userAnime?: { __typename?: 'UserAnime', id: string, status?: Status | null, score?: number | null, episodes?: number | null } | null }> | null };

export type CurrentlyAiringWithDateQueryVariables = Exact<{
  input?: InputMaybe<CurrentlyAiringInput>;
  limit?: InputMaybe<Scalars['Int']>;
}>;


export type CurrentlyAiringWithDateQuery = { __typename?: 'Query', currentlyAiring?: Array<{ __typename?: 'Anime', id: string, slug?: string | null, titleEn?: string | null, titleJp?: string | null, anidbid?: string | null, endDate?: any | null, startDate?: any | null, imageUrl?: string | null, duration?: string | null, ranking?: number | null, broadcast?: string | null, thetvdbid?: string | null, tags?: Array<string> | null, description?: string | null, nextEpisode?: { __typename?: 'Episode', id: string, animeId?: string | null, episodeNumber?: number | null, titleEn?: string | null, titleJp?: string | null, synopsis?: string | null, airDate?: any | null, airTime?: any | null, createdAt: string, updatedAt: string } | null, streamingPlatforms?: Array<{ __typename?: 'StreamingPlatform', platform: string, name?: string | null, url: string }> | null, userAnime?: { __typename?: 'UserAnime', id: string, status?: Status | null, score?: number | null, episodes?: number | null } | null }> | null };

export type CurrentlyAiringWithDateAndEpisodesQueryVariables = Exact<{
  input?: InputMaybe<CurrentlyAiringInput>;
  limit?: InputMaybe<Scalars['Int']>;
}>;


export type CurrentlyAiringWithDateAndEpisodesQuery = { __typename?: 'Query', currentlyAiring?: Array<{ __typename?: 'Anime', id: string, slug?: string | null, titleEn?: string | null, titleJp?: string | null, anidbid?: string | null, endDate?: any | null, startDate?: any | null, imageUrl?: string | null, duration?: string | null, ranking?: number | null, broadcast?: string | null, thetvdbid?: string | null, tags?: Array<string> | null, description?: string | null, nextEpisode?: { __typename?: 'Episode', id: string, animeId?: string | null, episodeNumber?: number | null, titleEn?: string | null, titleJp?: string | null, synopsis?: string | null, airDate?: any | null, airTime?: any | null } | null, episodes?: Array<{ __typename?: 'Episode', id: string, animeId?: string | null, episodeNumber?: number | null, titleEn?: string | null, titleJp?: string | null, synopsis?: string | null, airDate?: any | null, airTime?: any | null }> | null, userAnime?: { __typename?: 'UserAnime', id: string, status?: Status | null, score?: number | null, episodes?: number | null } | null }> | null };

export type RefreshTokenMutationVariables = Exact<{
  token: Scalars['String'];
}>;


export type RefreshTokenMutation = { __typename?: 'Mutation', RefreshToken: { __typename?: 'SigninResult', id: string, Credentials: { __typename?: 'Credentials', token?: string | null, refresh_token?: string | null } } };

export type RegisterMutationVariables = Exact<{
  input: RegisterInput;
}>;


export type RegisterMutation = { __typename?: 'Mutation', Register: { __typename?: 'RegisterResult', id: string } };

export type CreateSessionMutationVariables = Exact<{
  input: LoginInput;
}>;


export type CreateSessionMutation = { __typename?: 'Mutation', CreateSession?: { __typename?: 'SigninResult', id: string, Credentials: { __typename?: 'Credentials', refresh_token?: string | null, token?: string | null } } | null };

export type RequestPasswordResetMutationVariables = Exact<{
  input: RequestPasswordResetInput;
}>;


export type RequestPasswordResetMutation = { __typename?: 'Mutation', RequestPasswordReset: boolean };

export type ResetPasswordMutationVariables = Exact<{
  input: ResetPasswordInput;
}>;


export type ResetPasswordMutation = { __typename?: 'Mutation', ResetPassword: boolean };

export type VerifyEmailMutationVariables = Exact<{ [key: string]: never; }>;


export type VerifyEmailMutation = { __typename?: 'Mutation', VerifyEmail: boolean };

export type ResendVerificationEmailMutationVariables = Exact<{
  username: Scalars['String'];
}>;


export type ResendVerificationEmailMutation = { __typename?: 'Mutation', ResendVerificationEmail: boolean };

export type LogoutMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutMutation = { __typename?: 'Mutation', Logout: boolean };

export type GetUserDetailsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserDetailsQuery = { __typename?: 'Query', UserDetails: { __typename?: 'User', id: string, firstname: string, lastname: string, username: string, language: Language, email?: string | null, profileImageUrl?: string | null, bannerImageUrl?: string | null, bio?: string | null, accentColor?: string | null, listsPublic: boolean, active_sessions: Array<{ __typename?: 'SessionDetails', id: string, ip_address: string, token: string, user_agent: string, user_id: string }> } };

export type UpdateUserDetailsMutationVariables = Exact<{
  input: UpdateUserInput;
}>;


export type UpdateUserDetailsMutation = { __typename?: 'Mutation', UpdateUserDetails: { __typename?: 'User', id: string, firstname: string, lastname: string, username: string, language: Language, email?: string | null, profileImageUrl?: string | null, bannerImageUrl?: string | null, bio?: string | null, accentColor?: string | null, listsPublic: boolean } };

export type PublicUserAnimeStatusCountsQueryVariables = Exact<{
  userID: Scalars['String'];
}>;


export type PublicUserAnimeStatusCountsQuery = { __typename?: 'Query', PublicUserAnimeStatusCounts: { __typename?: 'UserAnimeStatusCounts', watching: any, planToWatch: any, completed: any, onHold: any, dropped: any } };

export type PublicUserWorkStatusCountsQueryVariables = Exact<{
  userID: Scalars['String'];
}>;


export type PublicUserWorkStatusCountsQuery = { __typename?: 'Query', PublicUserWorkStatusCounts: { __typename?: 'UserWorkStatusCounts', reading: any, planToRead: any, completed: any, onHold: any, dropped: any } };

export type PublicUserAnimesQueryVariables = Exact<{
  userID: Scalars['String'];
  input: UserAnimesInput;
}>;


export type PublicUserAnimesQuery = { __typename?: 'Query', PublicUserAnimes?: { __typename?: 'UserAnimePaginated', total: any, animes: Array<{ __typename?: 'UserAnime', id: string, animeID: string, status?: Status | null, episodes?: number | null, anime?: { __typename?: 'Anime', id: string, slug?: string | null, titleEn?: string | null, titleJp?: string | null, imageUrl?: string | null, episodeCount?: number | null, animeStatus?: string | null, tags?: Array<string> | null, description?: string | null } | null }> } | null };

export type PublicUserWorksQueryVariables = Exact<{
  userID: Scalars['String'];
  input: UserWorksInput;
}>;


export type PublicUserWorksQuery = { __typename?: 'Query', PublicUserWorks?: { __typename?: 'UserWorkPaginated', total: any, works: Array<{ __typename?: 'UserWork', id: string, workID: string, status?: WorkStatus | null, chapters?: number | null, work?: { __typename?: 'Work', id: string, urlSlug?: string | null, titleEn?: string | null, titleJp?: string | null, type: string, imageUrl?: string | null, score?: number | null, publishedFrom?: string | null, chapters?: number | null } | null }> } | null };

export type GetUserByUsernameQueryVariables = Exact<{
  username: Scalars['String'];
}>;


export type GetUserByUsernameQuery = { __typename?: 'Query', userByUsername?: { __typename?: 'PublicUser', id: string, username: string, firstname: string, lastname: string, profileImageUrl?: string | null, bannerImageUrl?: string | null, bio?: string | null, accentColor?: string | null, listsPublic: boolean } | null };

export type UploadBannerImageMutationVariables = Exact<{
  image: Scalars['Upload'];
}>;


export type UploadBannerImageMutation = { __typename?: 'Mutation', UploadBannerImage: { __typename?: 'User', id: string, username: string, profileImageUrl?: string | null, bannerImageUrl?: string | null, bio?: string | null, accentColor?: string | null, listsPublic: boolean } };

export type UploadProfileImageMutationVariables = Exact<{
  image: Scalars['Upload'];
}>;


export type UploadProfileImageMutation = { __typename?: 'Mutation', UploadProfileImage: { __typename?: 'User', id: string, firstname: string, lastname: string, username: string, language: Language, email?: string | null, profileImageUrl?: string | null, bannerImageUrl?: string | null, bio?: string | null, accentColor?: string | null, listsPublic: boolean } };

export type UserAnimeCountQueryVariables = Exact<{
  input: UserAnimesInput;
}>;


export type UserAnimeCountQuery = { __typename?: 'Query', UserAnimes?: { __typename?: 'UserAnimePaginated', total: any } | null };

export type UserAnimesQueryVariables = Exact<{
  input: UserAnimesInput;
}>;


export type UserAnimesQuery = { __typename?: 'Query', UserAnimes?: { __typename?: 'UserAnimePaginated', page: number, limit: number, total: any, animes: Array<{ __typename?: 'UserAnime', id: string, userID: string, animeID: string, status?: Status | null, score?: number | null, episodes?: number | null, rewatching?: number | null, rewatchingEpisodes?: number | null, tags?: Array<string> | null, listID?: string | null, createdAt?: string | null, updatedAt?: string | null, deletedAt?: string | null, anime?: { __typename?: 'Anime', id: string, slug?: string | null, titleEn?: string | null, titleJp?: string | null, titleRomaji?: string | null, titleKanji?: string | null, imageUrl?: string | null, startDate?: any | null, description?: string | null, episodeCount?: number | null, duration?: string | null, broadcast?: string | null, thetvdbid?: string | null, tags?: Array<string> | null, episodes?: Array<{ __typename?: 'Episode', id: string, animeId?: string | null, episodeNumber?: number | null, titleEn?: string | null, titleJp?: string | null, synopsis?: string | null, airDate?: any | null, createdAt: string, updatedAt: string }> | null } | null }> } | null };

export type AddAnimeMutationVariables = Exact<{
  input: UserAnimeInput;
}>;


export type AddAnimeMutation = { __typename?: 'Mutation', AddAnime: { __typename?: 'UserAnime', id: string } };

export type DeleteAnimeMutationVariables = Exact<{
  input: Scalars['ID'];
}>;


export type DeleteAnimeMutation = { __typename?: 'Mutation', DeleteAnime: boolean };

export type CharactersAndStaffByAnimeIdQueryVariables = Exact<{
  animeId: Scalars['ID'];
}>;


export type CharactersAndStaffByAnimeIdQuery = { __typename?: 'Query', charactersAndStaffByAnimeId?: Array<{ __typename?: 'CharacterWithStaff', character: { __typename?: 'AnimeCharacter', id: string, animeId: string, name: string, role: string, birthday?: string | null, zodiac?: string | null, gender?: string | null, race?: string | null, height?: string | null, weight?: string | null, title?: string | null, martialStatus?: string | null, summary?: string | null, image?: string | null, createdAt?: any | null, updatedAt?: any | null }, staff?: Array<{ __typename?: 'AnimeStaff', id: string, slug?: string | null, language?: string | null, givenName: string, familyName: string, image?: string | null, birthday?: string | null, birthPlace?: string | null, bloodType?: string | null, hobbies?: string | null, summary?: string | null, createdAt?: any | null, updatedAt?: any | null }> | null }> | null };

export type StaffByIdQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type StaffByIdQuery = { __typename?: 'Query', staff?: { __typename?: 'AnimeStaff', id: string, slug?: string | null, givenName: string, familyName: string, language?: string | null, image?: string | null, birthday?: string | null, birthPlace?: string | null, bloodType?: string | null, hobbies?: string | null, summary?: string | null, roles?: Array<{ __typename?: 'StaffRole', character: { __typename?: 'AnimeCharacter', id: string, name: string, role: string, image?: string | null }, anime?: { __typename?: 'Anime', id: string, slug?: string | null, titleEn?: string | null, titleJp?: string | null, imageUrl?: string | null, startDate?: any | null, animeStatus?: string | null } | null }> | null } | null };

export type StaffBySlugQueryVariables = Exact<{
  slug: Scalars['String'];
}>;


export type StaffBySlugQuery = { __typename?: 'Query', staffBySlug?: { __typename?: 'AnimeStaff', id: string, slug?: string | null, givenName: string, familyName: string, language?: string | null, image?: string | null, birthday?: string | null, birthPlace?: string | null, bloodType?: string | null, hobbies?: string | null, summary?: string | null, roles?: Array<{ __typename?: 'StaffRole', character: { __typename?: 'AnimeCharacter', id: string, name: string, role: string, image?: string | null }, anime?: { __typename?: 'Anime', id: string, slug?: string | null, titleEn?: string | null, titleJp?: string | null, imageUrl?: string | null, startDate?: any | null, animeStatus?: string | null } | null }> | null } | null };


export const GetHomePageDataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getHomePageData"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"topRatedAnime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"thetvdbid"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"episodeCount"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"userAnime"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"}}]}}]}}]}}]} as unknown as DocumentNode<GetHomePageDataQuery, GetHomePageDataQueryVariables>;
export const GetSeasonalAnimeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getSeasonalAnime"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"season"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Season"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"animeBySeasons"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"season"},"value":{"kind":"Variable","name":{"kind":"Name","value":"season"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"thetvdbid"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"episodeCount"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"userAnime"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"}}]}}]}}]}}]} as unknown as DocumentNode<GetSeasonalAnimeQuery, GetSeasonalAnimeQueryVariables>;
export const GetAnimeDetailsByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getAnimeDetailsByID"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"anime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"thetvdbid"}},{"kind":"Field","name":{"kind":"Name","value":"malId"}},{"kind":"Field","name":{"kind":"Name","value":"sourceWork"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"urlSlug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"titleRomaji"}},{"kind":"Field","name":{"kind":"Name","value":"titleKanji"}},{"kind":"Field","name":{"kind":"Name","value":"titleSynonyms"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"studios"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"episodeCount"}},{"kind":"Field","name":{"kind":"Name","value":"seasonNumber"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"animeId"}},{"kind":"Field","name":{"kind":"Name","value":"episodeNumber"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"synopsis"}},{"kind":"Field","name":{"kind":"Name","value":"airDate"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"relatedAnime"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"relation"}},{"kind":"Field","name":{"kind":"Name","value":"anime"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"broadcast"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"licensors"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"scheduleInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"jpnTime"}},{"kind":"Field","name":{"kind":"Name","value":"subTime"}},{"kind":"Field","name":{"kind":"Name","value":"dubTime"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"delayedTimetable"}},{"kind":"Field","name":{"kind":"Name","value":"subDelayedTimetable"}},{"kind":"Field","name":{"kind":"Name","value":"dubDelayedTimetable"}}]}},{"kind":"Field","name":{"kind":"Name","value":"streamingPlatforms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"platform"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"news"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"sourceUrl"}},{"kind":"Field","name":{"kind":"Name","value":"sourceName"}},{"kind":"Field","name":{"kind":"Name","value":"publishedDate"}},{"kind":"Field","name":{"kind":"Name","value":"episodeNumber"}},{"kind":"Field","name":{"kind":"Name","value":"language"}},{"kind":"Field","name":{"kind":"Name","value":"references"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"userAnime"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"}}]}}]}}]}}]} as unknown as DocumentNode<GetAnimeDetailsByIdQuery, GetAnimeDetailsByIdQueryVariables>;
export const GetAnimeSlugByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getAnimeSlugByID"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"anime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}}]}}]}}]} as unknown as DocumentNode<GetAnimeSlugByIdQuery, GetAnimeSlugByIdQueryVariables>;
export const GetAnimeDetailsBySlugDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getAnimeDetailsBySlug"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"animeBySlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"thetvdbid"}},{"kind":"Field","name":{"kind":"Name","value":"malId"}},{"kind":"Field","name":{"kind":"Name","value":"sourceWork"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"urlSlug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"titleRomaji"}},{"kind":"Field","name":{"kind":"Name","value":"titleKanji"}},{"kind":"Field","name":{"kind":"Name","value":"titleSynonyms"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"studios"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"episodeCount"}},{"kind":"Field","name":{"kind":"Name","value":"seasonNumber"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"animeId"}},{"kind":"Field","name":{"kind":"Name","value":"episodeNumber"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"synopsis"}},{"kind":"Field","name":{"kind":"Name","value":"airDate"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"relatedAnime"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"relation"}},{"kind":"Field","name":{"kind":"Name","value":"anime"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"broadcast"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"licensors"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"scheduleInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"jpnTime"}},{"kind":"Field","name":{"kind":"Name","value":"subTime"}},{"kind":"Field","name":{"kind":"Name","value":"dubTime"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"delayedTimetable"}},{"kind":"Field","name":{"kind":"Name","value":"subDelayedTimetable"}},{"kind":"Field","name":{"kind":"Name","value":"dubDelayedTimetable"}}]}},{"kind":"Field","name":{"kind":"Name","value":"streamingPlatforms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"platform"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"news"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"sourceUrl"}},{"kind":"Field","name":{"kind":"Name","value":"sourceName"}},{"kind":"Field","name":{"kind":"Name","value":"publishedDate"}},{"kind":"Field","name":{"kind":"Name","value":"episodeNumber"}},{"kind":"Field","name":{"kind":"Name","value":"language"}},{"kind":"Field","name":{"kind":"Name","value":"references"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"userAnime"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"}}]}}]}}]}}]} as unknown as DocumentNode<GetAnimeDetailsBySlugQuery, GetAnimeDetailsBySlugQueryVariables>;
export const GetCurrentlyPublishingWorksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getCurrentlyPublishingWorks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currentlyPublishingWorks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"urlSlug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"publishedFrom"}}]}}]}}]} as unknown as DocumentNode<GetCurrentlyPublishingWorksQuery, GetCurrentlyPublishingWorksQueryVariables>;
export const GetWorksOverviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getWorksOverview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"popular"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WorksInput"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rated"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WorksInput"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"newest"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WorksInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"popular"},"name":{"kind":"Name","value":"works"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"popular"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"works"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"urlSlug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"members"}},{"kind":"Field","name":{"kind":"Name","value":"publishedFrom"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"rated"},"name":{"kind":"Name","value":"works"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rated"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"works"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"urlSlug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"members"}},{"kind":"Field","name":{"kind":"Name","value":"publishedFrom"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"newest"},"name":{"kind":"Name","value":"works"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"newest"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"works"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"urlSlug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"members"}},{"kind":"Field","name":{"kind":"Name","value":"publishedFrom"}}]}}]}}]}}]} as unknown as DocumentNode<GetWorksOverviewQuery, GetWorksOverviewQueryVariables>;
export const GetWorksByTypeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getWorksByType"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WorksInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"works"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"page"}},{"kind":"Field","name":{"kind":"Name","value":"perPage"}},{"kind":"Field","name":{"kind":"Name","value":"works"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"urlSlug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"members"}},{"kind":"Field","name":{"kind":"Name","value":"publishedFrom"}}]}}]}}]}}]} as unknown as DocumentNode<GetWorksByTypeQuery, GetWorksByTypeQueryVariables>;
export const GetWorkBySlugDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getWorkBySlug"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workBySlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"malId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"urlSlug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"titleSynonyms"}},{"kind":"Field","name":{"kind":"Name","value":"synopsis"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"volumes"}},{"kind":"Field","name":{"kind":"Name","value":"chapters"}},{"kind":"Field","name":{"kind":"Name","value":"publishedFrom"}},{"kind":"Field","name":{"kind":"Name","value":"publishedTo"}},{"kind":"Field","name":{"kind":"Name","value":"demographic"}},{"kind":"Field","name":{"kind":"Name","value":"serialization"}},{"kind":"Field","name":{"kind":"Name","value":"authors"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"userWork"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"chapters"}},{"kind":"Field","name":{"kind":"Name","value":"volumes"}}]}},{"kind":"Field","name":{"kind":"Name","value":"adaptations"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"24"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"episodeCount"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}}]}}]}}]}}]} as unknown as DocumentNode<GetWorkBySlugQuery, GetWorkBySlugQueryVariables>;
export const UserWorksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserWorks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UserWorksInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"UserWorks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"page"}},{"kind":"Field","name":{"kind":"Name","value":"limit"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"works"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userID"}},{"kind":"Field","name":{"kind":"Name","value":"workID"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"chapters"}},{"kind":"Field","name":{"kind":"Name","value":"volumes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"work"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"urlSlug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"chapters"}},{"kind":"Field","name":{"kind":"Name","value":"volumes"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"publishedFrom"}}]}}]}}]}}]}}]} as unknown as DocumentNode<UserWorksQuery, UserWorksQueryVariables>;
export const UserWorkStatusCountsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserWorkStatusCounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"UserWorkStatusCounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reading"}},{"kind":"Field","name":{"kind":"Name","value":"planToRead"}},{"kind":"Field","name":{"kind":"Name","value":"completed"}},{"kind":"Field","name":{"kind":"Name","value":"onHold"}},{"kind":"Field","name":{"kind":"Name","value":"dropped"}}]}}]}}]} as unknown as DocumentNode<UserWorkStatusCountsQuery, UserWorkStatusCountsQueryVariables>;
export const UserAnimeStatusCountsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserAnimeStatusCounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"UserAnimeStatusCounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"watching"}},{"kind":"Field","name":{"kind":"Name","value":"planToWatch"}},{"kind":"Field","name":{"kind":"Name","value":"completed"}},{"kind":"Field","name":{"kind":"Name","value":"onHold"}},{"kind":"Field","name":{"kind":"Name","value":"dropped"}}]}}]}}]} as unknown as DocumentNode<UserAnimeStatusCountsQuery, UserAnimeStatusCountsQueryVariables>;
export const AddWorkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddWork"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UserWorkInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"AddWork"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"chapters"}},{"kind":"Field","name":{"kind":"Name","value":"volumes"}},{"kind":"Field","name":{"kind":"Name","value":"score"}}]}}]}}]} as unknown as DocumentNode<AddWorkMutation, AddWorkMutationVariables>;
export const UpdateWorkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateWork"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UserWorkInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"UpdateWork"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"chapters"}},{"kind":"Field","name":{"kind":"Name","value":"volumes"}},{"kind":"Field","name":{"kind":"Name","value":"score"}}]}}]}}]} as unknown as DocumentNode<UpdateWorkMutation, UpdateWorkMutationVariables>;
export const DeleteWorkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteWork"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"DeleteWork"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<DeleteWorkMutation, DeleteWorkMutationVariables>;
export const WatchedEpisodesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WatchedEpisodes"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"animeID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"WatchedEpisodes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"animeID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"animeID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"episodeNumber"}},{"kind":"Field","name":{"kind":"Name","value":"watchedAt"}}]}}]}}]} as unknown as DocumentNode<WatchedEpisodesQuery, WatchedEpisodesQueryVariables>;
export const MarkEpisodeWatchedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkEpisodeWatched"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"MarkEpisodeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"MarkEpisodeWatched"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"episodeNumber"}}]}}]}}]} as unknown as DocumentNode<MarkEpisodeWatchedMutation, MarkEpisodeWatchedMutationVariables>;
export const UnmarkEpisodeWatchedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnmarkEpisodeWatched"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"MarkEpisodeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"UnmarkEpisodeWatched"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<UnmarkEpisodeWatchedMutation, UnmarkEpisodeWatchedMutationVariables>;
export const ReadChaptersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ReadChapters"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"workID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ReadChapters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"workID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"workID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}},{"kind":"Field","name":{"kind":"Name","value":"readAt"}}]}}]}}]} as unknown as DocumentNode<ReadChaptersQuery, ReadChaptersQueryVariables>;
export const MarkChapterReadDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkChapterRead"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"MarkChapterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"MarkChapterRead"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"chapterNumber"}}]}}]}}]} as unknown as DocumentNode<MarkChapterReadMutation, MarkChapterReadMutationVariables>;
export const UnmarkChapterReadDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnmarkChapterRead"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"MarkChapterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"UnmarkChapterRead"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<UnmarkChapterReadMutation, UnmarkChapterReadMutationVariables>;
export const GetAnimeNewsByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getAnimeNewsByID"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"anime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"studios"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"news"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"sourceUrl"}},{"kind":"Field","name":{"kind":"Name","value":"sourceName"}},{"kind":"Field","name":{"kind":"Name","value":"publishedDate"}},{"kind":"Field","name":{"kind":"Name","value":"episodeNumber"}},{"kind":"Field","name":{"kind":"Name","value":"language"}},{"kind":"Field","name":{"kind":"Name","value":"references"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetAnimeNewsByIdQuery, GetAnimeNewsByIdQueryVariables>;
export const GetAnimeNewsBySlugDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getAnimeNewsBySlug"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"animeBySlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"studios"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"news"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"sourceUrl"}},{"kind":"Field","name":{"kind":"Name","value":"sourceName"}},{"kind":"Field","name":{"kind":"Name","value":"publishedDate"}},{"kind":"Field","name":{"kind":"Name","value":"episodeNumber"}},{"kind":"Field","name":{"kind":"Name","value":"language"}},{"kind":"Field","name":{"kind":"Name","value":"references"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetAnimeNewsBySlugQuery, GetAnimeNewsBySlugQueryVariables>;
export const CurrentlyAiringDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"currentlyAiring"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currentlyAiring"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"broadcast"}},{"kind":"Field","name":{"kind":"Name","value":"thetvdbid"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"nextEpisode"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"animeId"}},{"kind":"Field","name":{"kind":"Name","value":"episodeNumber"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"synopsis"}},{"kind":"Field","name":{"kind":"Name","value":"airDate"}},{"kind":"Field","name":{"kind":"Name","value":"airTime"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"userAnime"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"}}]}}]}}]}}]} as unknown as DocumentNode<CurrentlyAiringQuery, CurrentlyAiringQueryVariables>;
export const CurrentlyAiringWithDateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"currentlyAiringWithDate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"CurrentlyAiringInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currentlyAiring"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"broadcast"}},{"kind":"Field","name":{"kind":"Name","value":"thetvdbid"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"nextEpisode"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"animeId"}},{"kind":"Field","name":{"kind":"Name","value":"episodeNumber"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"synopsis"}},{"kind":"Field","name":{"kind":"Name","value":"airDate"}},{"kind":"Field","name":{"kind":"Name","value":"airTime"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"streamingPlatforms"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"platform"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}},{"kind":"Field","name":{"kind":"Name","value":"userAnime"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"}}]}}]}}]}}]} as unknown as DocumentNode<CurrentlyAiringWithDateQuery, CurrentlyAiringWithDateQueryVariables>;
export const CurrentlyAiringWithDateAndEpisodesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"currentlyAiringWithDateAndEpisodes"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"CurrentlyAiringInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currentlyAiring"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"broadcast"}},{"kind":"Field","name":{"kind":"Name","value":"thetvdbid"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"nextEpisode"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"animeId"}},{"kind":"Field","name":{"kind":"Name","value":"episodeNumber"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"synopsis"}},{"kind":"Field","name":{"kind":"Name","value":"airDate"}},{"kind":"Field","name":{"kind":"Name","value":"airTime"}}]}},{"kind":"Field","name":{"kind":"Name","value":"episodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"animeId"}},{"kind":"Field","name":{"kind":"Name","value":"episodeNumber"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"synopsis"}},{"kind":"Field","name":{"kind":"Name","value":"airDate"}},{"kind":"Field","name":{"kind":"Name","value":"airTime"}}]}},{"kind":"Field","name":{"kind":"Name","value":"userAnime"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"}}]}}]}}]}}]} as unknown as DocumentNode<CurrentlyAiringWithDateAndEpisodesQuery, CurrentlyAiringWithDateAndEpisodesQueryVariables>;
export const RefreshTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefreshToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"RefreshToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"Credentials"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"refresh_token"}}]}}]}}]}}]} as unknown as DocumentNode<RefreshTokenMutation, RefreshTokenMutationVariables>;
export const RegisterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Register"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RegisterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"Register"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<RegisterMutation, RegisterMutationVariables>;
export const CreateSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LoginInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"CreateSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"Credentials"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refresh_token"}},{"kind":"Field","name":{"kind":"Name","value":"token"}}]}}]}}]}}]} as unknown as DocumentNode<CreateSessionMutation, CreateSessionMutationVariables>;
export const RequestPasswordResetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RequestPasswordReset"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RequestPasswordResetInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"RequestPasswordReset"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<RequestPasswordResetMutation, RequestPasswordResetMutationVariables>;
export const ResetPasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResetPassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ResetPasswordInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ResetPassword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<ResetPasswordMutation, ResetPasswordMutationVariables>;
export const VerifyEmailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VerifyEmail"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"VerifyEmail"}}]}}]} as unknown as DocumentNode<VerifyEmailMutation, VerifyEmailMutationVariables>;
export const ResendVerificationEmailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResendVerificationEmail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ResendVerificationEmail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}}]}]}}]} as unknown as DocumentNode<ResendVerificationEmailMutation, ResendVerificationEmailMutationVariables>;
export const LogoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Logout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"Logout"}}]}}]} as unknown as DocumentNode<LogoutMutation, LogoutMutationVariables>;
export const GetUserDetailsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getUserDetails"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"UserDetails"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"firstname"}},{"kind":"Field","name":{"kind":"Name","value":"lastname"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"language"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"profileImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"bannerImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"accentColor"}},{"kind":"Field","name":{"kind":"Name","value":"listsPublic"}},{"kind":"Field","name":{"kind":"Name","value":"active_sessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"ip_address"}},{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"user_agent"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}}]}}]}}]}}]} as unknown as DocumentNode<GetUserDetailsQuery, GetUserDetailsQueryVariables>;
export const UpdateUserDetailsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUserDetails"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateUserInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"UpdateUserDetails"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"firstname"}},{"kind":"Field","name":{"kind":"Name","value":"lastname"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"language"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"profileImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"bannerImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"accentColor"}},{"kind":"Field","name":{"kind":"Name","value":"listsPublic"}}]}}]}}]} as unknown as DocumentNode<UpdateUserDetailsMutation, UpdateUserDetailsMutationVariables>;
export const PublicUserAnimeStatusCountsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PublicUserAnimeStatusCounts"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"PublicUserAnimeStatusCounts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"watching"}},{"kind":"Field","name":{"kind":"Name","value":"planToWatch"}},{"kind":"Field","name":{"kind":"Name","value":"completed"}},{"kind":"Field","name":{"kind":"Name","value":"onHold"}},{"kind":"Field","name":{"kind":"Name","value":"dropped"}}]}}]}}]} as unknown as DocumentNode<PublicUserAnimeStatusCountsQuery, PublicUserAnimeStatusCountsQueryVariables>;
export const PublicUserWorkStatusCountsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PublicUserWorkStatusCounts"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"PublicUserWorkStatusCounts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reading"}},{"kind":"Field","name":{"kind":"Name","value":"planToRead"}},{"kind":"Field","name":{"kind":"Name","value":"completed"}},{"kind":"Field","name":{"kind":"Name","value":"onHold"}},{"kind":"Field","name":{"kind":"Name","value":"dropped"}}]}}]}}]} as unknown as DocumentNode<PublicUserWorkStatusCountsQuery, PublicUserWorkStatusCountsQueryVariables>;
export const PublicUserAnimesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PublicUserAnimes"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UserAnimesInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"PublicUserAnimes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"animes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"animeID"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"}},{"kind":"Field","name":{"kind":"Name","value":"anime"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"episodeCount"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"description"}}]}}]}}]}}]}}]} as unknown as DocumentNode<PublicUserAnimesQuery, PublicUserAnimesQueryVariables>;
export const PublicUserWorksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PublicUserWorks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userID"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UserWorksInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"PublicUserWorks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userID"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userID"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"works"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"workID"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"chapters"}},{"kind":"Field","name":{"kind":"Name","value":"work"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"urlSlug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"publishedFrom"}},{"kind":"Field","name":{"kind":"Name","value":"chapters"}}]}}]}}]}}]}}]} as unknown as DocumentNode<PublicUserWorksQuery, PublicUserWorksQueryVariables>;
export const GetUserByUsernameDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getUserByUsername"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userByUsername"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"firstname"}},{"kind":"Field","name":{"kind":"Name","value":"lastname"}},{"kind":"Field","name":{"kind":"Name","value":"profileImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"bannerImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"accentColor"}},{"kind":"Field","name":{"kind":"Name","value":"listsPublic"}}]}}]}}]} as unknown as DocumentNode<GetUserByUsernameQuery, GetUserByUsernameQueryVariables>;
export const UploadBannerImageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UploadBannerImage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"image"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Upload"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"UploadBannerImage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"image"},"value":{"kind":"Variable","name":{"kind":"Name","value":"image"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"profileImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"bannerImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"accentColor"}},{"kind":"Field","name":{"kind":"Name","value":"listsPublic"}}]}}]}}]} as unknown as DocumentNode<UploadBannerImageMutation, UploadBannerImageMutationVariables>;
export const UploadProfileImageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UploadProfileImage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"image"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Upload"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"UploadProfileImage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"image"},"value":{"kind":"Variable","name":{"kind":"Name","value":"image"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"firstname"}},{"kind":"Field","name":{"kind":"Name","value":"lastname"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"language"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"profileImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"bannerImageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"bio"}},{"kind":"Field","name":{"kind":"Name","value":"accentColor"}},{"kind":"Field","name":{"kind":"Name","value":"listsPublic"}}]}}]}}]} as unknown as DocumentNode<UploadProfileImageMutation, UploadProfileImageMutationVariables>;
export const UserAnimeCountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserAnimeCount"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UserAnimesInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"UserAnimes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}}]}}]}}]} as unknown as DocumentNode<UserAnimeCountQuery, UserAnimeCountQueryVariables>;
export const UserAnimesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserAnimes"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UserAnimesInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"UserAnimes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"page"}},{"kind":"Field","name":{"kind":"Name","value":"limit"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"animes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"userID"}},{"kind":"Field","name":{"kind":"Name","value":"animeID"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"}},{"kind":"Field","name":{"kind":"Name","value":"rewatching"}},{"kind":"Field","name":{"kind":"Name","value":"rewatchingEpisodes"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"listID"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"deletedAt"}},{"kind":"Field","name":{"kind":"Name","value":"anime"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"titleRomaji"}},{"kind":"Field","name":{"kind":"Name","value":"titleKanji"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"episodeCount"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"broadcast"}},{"kind":"Field","name":{"kind":"Name","value":"thetvdbid"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"animeId"}},{"kind":"Field","name":{"kind":"Name","value":"episodeNumber"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"synopsis"}},{"kind":"Field","name":{"kind":"Name","value":"airDate"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<UserAnimesQuery, UserAnimesQueryVariables>;
export const AddAnimeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddAnime"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UserAnimeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"AddAnime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<AddAnimeMutation, AddAnimeMutationVariables>;
export const DeleteAnimeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteAnime"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"DeleteAnime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<DeleteAnimeMutation, DeleteAnimeMutationVariables>;
export const CharactersAndStaffByAnimeIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CharactersAndStaffByAnimeId"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"animeId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"charactersAndStaffByAnimeId"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"animeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"animeId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"character"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"animeId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"birthday"}},{"kind":"Field","name":{"kind":"Name","value":"zodiac"}},{"kind":"Field","name":{"kind":"Name","value":"gender"}},{"kind":"Field","name":{"kind":"Name","value":"race"}},{"kind":"Field","name":{"kind":"Name","value":"height"}},{"kind":"Field","name":{"kind":"Name","value":"weight"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"martialStatus"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"staff"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"language"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"birthday"}},{"kind":"Field","name":{"kind":"Name","value":"birthPlace"}},{"kind":"Field","name":{"kind":"Name","value":"bloodType"}},{"kind":"Field","name":{"kind":"Name","value":"hobbies"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]}}]} as unknown as DocumentNode<CharactersAndStaffByAnimeIdQuery, CharactersAndStaffByAnimeIdQueryVariables>;
export const StaffByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"StaffById"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"staff"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"language"}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"birthday"}},{"kind":"Field","name":{"kind":"Name","value":"birthPlace"}},{"kind":"Field","name":{"kind":"Name","value":"bloodType"}},{"kind":"Field","name":{"kind":"Name","value":"hobbies"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"roles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"character"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"image"}}]}},{"kind":"Field","name":{"kind":"Name","value":"anime"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}}]}}]}}]}}]}}]} as unknown as DocumentNode<StaffByIdQuery, StaffByIdQueryVariables>;
export const StaffBySlugDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"StaffBySlug"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"staffBySlug"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"language"}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"birthday"}},{"kind":"Field","name":{"kind":"Name","value":"birthPlace"}},{"kind":"Field","name":{"kind":"Name","value":"bloodType"}},{"kind":"Field","name":{"kind":"Name","value":"hobbies"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"roles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"character"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"image"}}]}},{"kind":"Field","name":{"kind":"Name","value":"anime"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}}]}}]}}]}}]}}]} as unknown as DocumentNode<StaffBySlugQuery, StaffBySlugQueryVariables>;