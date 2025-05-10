/* eslint-disable */
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
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
  /** RFC3339 formatted DateTime */
  Time: any;
};

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
  /** ID of the anime */
  id: Scalars['ID'];
  /** Image URL of the anime */
  imageUrl?: Maybe<Scalars['String']>;
  /** Anime licensors */
  licensors?: Maybe<Array<Scalars['String']>>;
  /** Anime rank */
  ranking?: Maybe<Scalars['Int']>;
  /** Anime rating */
  rating?: Maybe<Scalars['String']>;
  /** Anime source (myanimelist, anime-planet, anidb, anilist, kitsu, anime_news_network) */
  source?: Maybe<Scalars['String']>;
  /** Anime first air date */
  startDate?: Maybe<Scalars['Time']>;
  /** Studios of the anime */
  studios?: Maybe<Array<Scalars['String']>>;
  /** Tags of the anime */
  tags?: Maybe<Array<Scalars['String']>>;
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
  updatedAt: Scalars['String'];
};

export type AnimeApi = {
  __typename?: 'AnimeApi';
  /** Version of event anime-api service */
  version: Scalars['String'];
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

export type ApiInfo = {
  __typename?: 'ApiInfo';
  /** API Info of the AnimeAPI */
  animeApi: AnimeApi;
  /** Name of the API */
  name: Scalars['String'];
  /** API Info of the ScraperAPI */
  scraperAPI: ScraperApi;
};

export type ChangePasswordInput = {
  new_password: Scalars['String'];
  old_password: Scalars['String'];
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
  refresh_token: Scalars['String'];
  token: Scalars['String'];
};

export type Episode = {
  __typename?: 'Episode';
  /** Episode air date */
  airDate?: Maybe<Scalars['Time']>;
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

export type LoginInput = {
  password: Scalars['String'];
  username: Scalars['String'];
};

export type Mutation = {
  __typename?: 'Mutation';
  CreatUser: User;
  CreateSession?: Maybe<SigninResult>;
  RefreshToken: SigninResult;
  Register: RegisterResult;
  RequestPasswordReset: Scalars['Boolean'];
  UpdateUserDetails: User;
  registerPublicKey?: Maybe<Key>;
  /** Save link */
  saveLink: Link;
};


export type MutationCreatUserArgs = {
  input: CreateUserInput;
};


export type MutationCreateSessionArgs = {
  input?: InputMaybe<LoginInput>;
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


export type MutationUpdateUserDetailsArgs = {
  input: UpdateUserInput;
};


export type MutationRegisterPublicKeyArgs = {
  publicKey: Scalars['String'];
};


export type MutationSaveLinkArgs = {
  input?: InputMaybe<SaveLinkInput>;
};

export type Query = {
  __typename?: 'Query';
  UserDetails: User;
  /** Get anime by ID */
  anime: Anime;
  /** AnimeAPI info */
  apiInfo: ApiInfo;
  availabilityByUsername: Scalars['Boolean'];
  /** Get currently airing anime */
  currentlyAiring?: Maybe<Array<Anime>>;
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
  /** Get most popular anime with a response limit */
  mostPopularAnime?: Maybe<Array<Anime>>;
  /** Get newest anime with a response limit */
  newestAnime?: Maybe<Array<Anime>>;
  /** Search thetvdb for anime */
  searchTheTVDB?: Maybe<Array<TheTvdbAnime>>;
  /** sync thetvdb */
  syncLink: Scalars['Boolean'];
  /** Get top rated anime with a response limit */
  topRatedAnime?: Maybe<Array<Anime>>;
};


export type QueryAnimeArgs = {
  id: Scalars['ID'];
};


export type QueryAvailabilityByUsernameArgs = {
  username: Scalars['String'];
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


export type QueryMostPopularAnimeArgs = {
  limit?: InputMaybe<Scalars['Int']>;
};


export type QueryNewestAnimeArgs = {
  limit?: InputMaybe<Scalars['Int']>;
};


export type QuerySearchTheTvdbArgs = {
  input?: InputMaybe<TheTvdbSearchInput>;
};


export type QuerySyncLinkArgs = {
  linkID: Scalars['String'];
};


export type QueryTopRatedAnimeArgs = {
  limit?: InputMaybe<Scalars['Int']>;
};

export type RegisterInput = {
  password: Scalars['String'];
  username: Scalars['String'];
};

export type RegisterResult = {
  __typename?: 'RegisterResult';
  id: Scalars['String'];
};

export type RequestPasswordResetInput = {
  email: Scalars['String'];
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
  email?: InputMaybe<Scalars['String']>;
  firstname?: InputMaybe<Scalars['String']>;
  language?: InputMaybe<Language>;
  lastname?: InputMaybe<Scalars['String']>;
  username?: InputMaybe<Scalars['String']>;
};

export type User = {
  __typename?: 'User';
  active_sessions: Array<SessionDetails>;
  email?: Maybe<Scalars['String']>;
  firstname: Scalars['String'];
  id: Scalars['ID'];
  language: Language;
  lastname: Scalars['String'];
  username: Scalars['String'];
};

export type GetHomePageDataQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']>;
}>;


export type GetHomePageDataQuery = { __typename?: 'Query', topRatedAnime?: Array<{ __typename?: 'Anime', id: string, anidbid?: string | null, titleEn?: string | null, imageUrl?: string | null, duration?: string | null, tags?: Array<string> | null, episodeCount?: number | null, animeStatus?: string | null, rating?: string | null, startDate?: any | null, ranking?: number | null }> | null, mostPopularAnime?: Array<{ __typename?: 'Anime', id: string, anidbid?: string | null, titleEn?: string | null, imageUrl?: string | null, duration?: string | null, tags?: Array<string> | null, episodeCount?: number | null, animeStatus?: string | null, rating?: string | null, startDate?: any | null, ranking?: number | null }> | null, newestAnime?: Array<{ __typename?: 'Anime', id: string, anidbid?: string | null, titleEn?: string | null, imageUrl?: string | null, duration?: string | null, tags?: Array<string> | null, episodeCount?: number | null, animeStatus?: string | null, rating?: string | null, startDate?: any | null, ranking?: number | null }> | null };

export type GetAnimeDetailsByIdQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type GetAnimeDetailsByIdQuery = { __typename?: 'Query', anime: { __typename?: 'Anime', id: string, anidbid?: string | null, titleEn?: string | null, titleJp?: string | null, titleRomaji?: string | null, titleKanji?: string | null, titleSynonyms?: Array<string> | null, description?: string | null, imageUrl?: string | null, tags?: Array<string> | null, studios?: Array<string> | null, animeStatus?: string | null, episodeCount?: number | null, duration?: string | null, rating?: string | null, startDate?: any | null, endDate?: any | null, broadcast?: string | null, source?: string | null, licensors?: Array<string> | null, ranking?: number | null, createdAt: string, updatedAt: string, episodes?: Array<{ __typename?: 'Episode', id: string, animeId?: string | null, episodeNumber?: number | null, titleEn?: string | null, titleJp?: string | null, synopsis?: string | null, airDate?: any | null, createdAt: string, updatedAt: string }> | null } };

export type CurrentlyAiringQueryVariables = Exact<{ [key: string]: never; }>;


export type CurrentlyAiringQuery = { __typename?: 'Query', currentlyAiring?: Array<{ __typename?: 'Anime', id: string, titleEn?: string | null, titleJp?: string | null, endDate?: any | null, startDate?: any | null, imageUrl?: string | null, duration?: string | null, ranking?: number | null, episodes?: Array<{ __typename?: 'Episode', airDate?: any | null, titleEn?: string | null }> | null }> | null };

export type RefreshTokenMutationVariables = Exact<{
  token: Scalars['String'];
}>;


export type RefreshTokenMutation = { __typename?: 'Mutation', RefreshToken: { __typename?: 'SigninResult', id: string, Credentials: { __typename?: 'Credentials', refresh_token: string, token: string } } };

export type RegisterMutationVariables = Exact<{
  input: RegisterInput;
}>;


export type RegisterMutation = { __typename?: 'Mutation', Register: { __typename?: 'RegisterResult', id: string } };

export type CreateSessionMutationVariables = Exact<{
  input: LoginInput;
}>;


export type CreateSessionMutation = { __typename?: 'Mutation', CreateSession?: { __typename?: 'SigninResult', id: string, Credentials: { __typename?: 'Credentials', refresh_token: string, token: string } } | null };

export type GetUserDetailsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserDetailsQuery = { __typename?: 'Query', UserDetails: { __typename?: 'User', id: string, firstname: string, lastname: string, username: string, language: Language, email?: string | null, active_sessions: Array<{ __typename?: 'SessionDetails', id: string, ip_address: string, token: string, user_agent: string, user_id: string }> } };

export type UpdateUserDetailsMutationVariables = Exact<{
  input: UpdateUserInput;
}>;


export type UpdateUserDetailsMutation = { __typename?: 'Mutation', UpdateUserDetails: { __typename?: 'User', id: string, firstname: string, lastname: string, username: string, language: Language, email?: string | null } };


export const GetHomePageDataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getHomePageData"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"topRatedAnime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"episodeCount"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}}]}},{"kind":"Field","name":{"kind":"Name","value":"mostPopularAnime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"episodeCount"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}}]}},{"kind":"Field","name":{"kind":"Name","value":"newestAnime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"100"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"episodeCount"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}}]}}]}}]} as unknown as DocumentNode<GetHomePageDataQuery, GetHomePageDataQueryVariables>;
export const GetAnimeDetailsByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getAnimeDetailsByID"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"anime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"titleRomaji"}},{"kind":"Field","name":{"kind":"Name","value":"titleKanji"}},{"kind":"Field","name":{"kind":"Name","value":"titleSynonyms"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"studios"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"episodeCount"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"animeId"}},{"kind":"Field","name":{"kind":"Name","value":"episodeNumber"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"synopsis"}},{"kind":"Field","name":{"kind":"Name","value":"airDate"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"broadcast"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"licensors"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetAnimeDetailsByIdQuery, GetAnimeDetailsByIdQueryVariables>;
export const CurrentlyAiringDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"currentlyAiring"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currentlyAiring"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"airDate"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}}]}}]}}]}}]} as unknown as DocumentNode<CurrentlyAiringQuery, CurrentlyAiringQueryVariables>;
export const RefreshTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RefreshToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"RefreshToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"Credentials"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refresh_token"}},{"kind":"Field","name":{"kind":"Name","value":"token"}}]}}]}}]}}]} as unknown as DocumentNode<RefreshTokenMutation, RefreshTokenMutationVariables>;
export const RegisterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Register"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RegisterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"Register"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<RegisterMutation, RegisterMutationVariables>;
export const CreateSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LoginInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"CreateSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"Credentials"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"refresh_token"}},{"kind":"Field","name":{"kind":"Name","value":"token"}}]}}]}}]}}]} as unknown as DocumentNode<CreateSessionMutation, CreateSessionMutationVariables>;
export const GetUserDetailsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getUserDetails"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"UserDetails"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"firstname"}},{"kind":"Field","name":{"kind":"Name","value":"lastname"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"language"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"active_sessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"ip_address"}},{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"user_agent"}},{"kind":"Field","name":{"kind":"Name","value":"user_id"}}]}}]}}]}}]} as unknown as DocumentNode<GetUserDetailsQuery, GetUserDetailsQueryVariables>;
export const UpdateUserDetailsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUserDetails"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateUserInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"UpdateUserDetails"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"firstname"}},{"kind":"Field","name":{"kind":"Name","value":"lastname"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"language"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}}]}}]} as unknown as DocumentNode<UpdateUserDetailsMutation, UpdateUserDetailsMutationVariables>;