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

export type Query = {
  __typename?: 'Query';
  /** Get anime by ID */
  anime: Anime;
  /** AnimeAPI info */
  apiInfo: ApiInfo;
  /** Search for anime in the database */
  dbSearch?: Maybe<Array<Anime>>;
  /** Get episode by ID */
  episode: Episode;
  /** Get episodes by anime ID */
  episodesByAnimeId?: Maybe<Array<Episode>>;
  /** Get most popular anime with a response limit */
  mostPopularAnime?: Maybe<Array<Anime>>;
  /** Get newest anime with a response limit */
  newestAnime?: Maybe<Array<Anime>>;
  /** Get top rated anime with a response limit */
  topRatedAnime?: Maybe<Array<Anime>>;
};


export type QueryAnimeArgs = {
  id: Scalars['ID'];
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


export type QueryMostPopularAnimeArgs = {
  limit?: InputMaybe<Scalars['Int']>;
};


export type QueryNewestAnimeArgs = {
  limit?: InputMaybe<Scalars['Int']>;
};


export type QueryTopRatedAnimeArgs = {
  limit?: InputMaybe<Scalars['Int']>;
};

export type GetHomePageDataQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']>;
}>;


export type GetHomePageDataQuery = { __typename?: 'Query', topRatedAnime?: Array<{ __typename?: 'Anime', id: string, anidbid?: string | null, titleEn?: string | null, imageUrl?: string | null, duration?: string | null, tags?: Array<string> | null, episodeCount?: number | null, animeStatus?: string | null, rating?: string | null, startDate?: any | null, ranking?: number | null }> | null, mostPopularAnime?: Array<{ __typename?: 'Anime', id: string, anidbid?: string | null, titleEn?: string | null, imageUrl?: string | null, duration?: string | null, tags?: Array<string> | null, episodeCount?: number | null, animeStatus?: string | null, rating?: string | null, startDate?: any | null, ranking?: number | null }> | null, newestAnime?: Array<{ __typename?: 'Anime', id: string, anidbid?: string | null, titleEn?: string | null, imageUrl?: string | null, duration?: string | null, tags?: Array<string> | null, episodeCount?: number | null, animeStatus?: string | null, rating?: string | null, startDate?: any | null, ranking?: number | null }> | null };

export type GetAnimeDetailsByIdQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type GetAnimeDetailsByIdQuery = { __typename?: 'Query', anime: { __typename?: 'Anime', id: string, anidbid?: string | null, titleEn?: string | null, titleJp?: string | null, titleRomaji?: string | null, titleKanji?: string | null, titleSynonyms?: Array<string> | null, description?: string | null, imageUrl?: string | null, tags?: Array<string> | null, studios?: Array<string> | null, animeStatus?: string | null, episodeCount?: number | null, duration?: string | null, rating?: string | null, startDate?: any | null, endDate?: any | null, broadcast?: string | null, source?: string | null, licensors?: Array<string> | null, ranking?: number | null, createdAt: string, updatedAt: string, episodes?: Array<{ __typename?: 'Episode', id: string, animeId?: string | null, episodeNumber?: number | null, titleEn?: string | null, titleJp?: string | null, synopsis?: string | null, airDate?: any | null, createdAt: string, updatedAt: string }> | null } };


export const GetHomePageDataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getHomePageData"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"topRatedAnime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"episodeCount"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}}]}},{"kind":"Field","name":{"kind":"Name","value":"mostPopularAnime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"episodeCount"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}}]}},{"kind":"Field","name":{"kind":"Name","value":"newestAnime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"100"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"episodeCount"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}}]}}]}}]} as unknown as DocumentNode<GetHomePageDataQuery, GetHomePageDataQueryVariables>;
export const GetAnimeDetailsByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getAnimeDetailsByID"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"anime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"titleRomaji"}},{"kind":"Field","name":{"kind":"Name","value":"titleKanji"}},{"kind":"Field","name":{"kind":"Name","value":"titleSynonyms"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"studios"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"episodeCount"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"animeId"}},{"kind":"Field","name":{"kind":"Name","value":"episodeNumber"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"synopsis"}},{"kind":"Field","name":{"kind":"Name","value":"airDate"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"broadcast"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"licensors"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetAnimeDetailsByIdQuery, GetAnimeDetailsByIdQueryVariables>;