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

export type Anime = {
  __typename?: 'Anime';
  anidbid?: Maybe<Scalars['String']>;
  animeStatus?: Maybe<Scalars['String']>;
  broadcast?: Maybe<Scalars['String']>;
  createdAt: Scalars['String'];
  description?: Maybe<Scalars['String']>;
  duration?: Maybe<Scalars['String']>;
  endDate?: Maybe<Scalars['Time']>;
  episodes?: Maybe<Scalars['Int']>;
  id: Scalars['ID'];
  imageUrl?: Maybe<Scalars['String']>;
  licensors?: Maybe<Array<Scalars['String']>>;
  ranking?: Maybe<Scalars['Int']>;
  rating?: Maybe<Scalars['String']>;
  source?: Maybe<Scalars['String']>;
  startDate?: Maybe<Scalars['Time']>;
  studios?: Maybe<Array<Scalars['String']>>;
  tags?: Maybe<Array<Scalars['String']>>;
  titleEn?: Maybe<Scalars['String']>;
  titleJp?: Maybe<Scalars['String']>;
  titleKanji?: Maybe<Scalars['String']>;
  titleRomaji?: Maybe<Scalars['String']>;
  titleSynonyms?: Maybe<Array<Scalars['String']>>;
  updatedAt: Scalars['String'];
};

export type AnimeApi = {
  __typename?: 'AnimeApi';
  /** Version of event publish service */
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
  animeApi: AnimeApi;
  name: Scalars['String'];
};

export type Query = {
  __typename?: 'Query';
  anime: Anime;
  apiInfo: ApiInfo;
  dbSearch?: Maybe<Array<Anime>>;
  mostPopularAnime?: Maybe<Array<Anime>>;
  newestAnime?: Maybe<Array<Anime>>;
  topRatedAnime?: Maybe<Array<Anime>>;
};


export type QueryAnimeArgs = {
  id: Scalars['ID'];
};


export type QueryDbSearchArgs = {
  searchQuery: AnimeSearchInput;
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


export type GetHomePageDataQuery = { __typename?: 'Query', topRatedAnime?: Array<{ __typename?: 'Anime', id: string, anidbid?: string | null, titleEn?: string | null, imageUrl?: string | null, duration?: string | null, tags?: Array<string> | null, episodes?: number | null, animeStatus?: string | null, rating?: string | null, startDate?: any | null, ranking?: number | null }> | null, mostPopularAnime?: Array<{ __typename?: 'Anime', id: string, anidbid?: string | null, titleEn?: string | null, imageUrl?: string | null, duration?: string | null, tags?: Array<string> | null, episodes?: number | null, animeStatus?: string | null, rating?: string | null, startDate?: any | null, ranking?: number | null }> | null, newestAnime?: Array<{ __typename?: 'Anime', id: string, anidbid?: string | null, titleEn?: string | null, imageUrl?: string | null, duration?: string | null, tags?: Array<string> | null, episodes?: number | null, animeStatus?: string | null, rating?: string | null, startDate?: any | null, ranking?: number | null }> | null };

export type GetAnimeDetailsByIdQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type GetAnimeDetailsByIdQuery = { __typename?: 'Query', anime: { __typename?: 'Anime', id: string, anidbid?: string | null, titleEn?: string | null, titleJp?: string | null, titleKanji?: string | null, titleRomaji?: string | null, titleSynonyms?: Array<string> | null, description?: string | null, imageUrl?: string | null, duration?: string | null, tags?: Array<string> | null, studios?: Array<string> | null, episodes?: number | null, animeStatus?: string | null, rating?: string | null, createdAt: string, updatedAt: string, startDate?: any | null, endDate?: any | null, broadcast?: string | null, ranking?: number | null } };


export const GetHomePageDataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getHomePageData"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"topRatedAnime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}}]}},{"kind":"Field","name":{"kind":"Name","value":"mostPopularAnime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}}]}},{"kind":"Field","name":{"kind":"Name","value":"newestAnime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"100"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}}]}}]}}]} as unknown as DocumentNode<GetHomePageDataQuery, GetHomePageDataQueryVariables>;
export const GetAnimeDetailsByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"getAnimeDetailsByID"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"anime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"anidbid"}},{"kind":"Field","name":{"kind":"Name","value":"titleEn"}},{"kind":"Field","name":{"kind":"Name","value":"titleJp"}},{"kind":"Field","name":{"kind":"Name","value":"titleKanji"}},{"kind":"Field","name":{"kind":"Name","value":"titleRomaji"}},{"kind":"Field","name":{"kind":"Name","value":"titleSynonyms"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"studios"}},{"kind":"Field","name":{"kind":"Name","value":"episodes"}},{"kind":"Field","name":{"kind":"Name","value":"animeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"broadcast"}},{"kind":"Field","name":{"kind":"Name","value":"ranking"}}]}}]}}]} as unknown as DocumentNode<GetAnimeDetailsByIdQuery, GetAnimeDetailsByIdQueryVariables>;