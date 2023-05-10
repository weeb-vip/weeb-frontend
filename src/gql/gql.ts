/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 */
const documents = {
    "\n    query getHomePageData($limit: Int) {\n        topRatedAnime(limit: $limit) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodes\n            animeStatus\n            imageUrl\n            rating\n            startDate\n        }\n        mostPopularAnime(limit: $limit) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodes\n            animeStatus\n            imageUrl\n            rating\n            startDate\n        }\n        newestAnime(limit:100) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodes\n            animeStatus\n            imageUrl\n            rating\n            startDate\n        }\n    }\n": types.GetHomePageDataDocument,
    "\n    query getAnimeDetailsByID($id: ID!) {\n    \tanime(id: $id) {\n        id\n        anidbid\n        titleEn\n        titleJp\n        titleKanji\n        titleRomaji\n        titleSynonyms\n        description\n        imageUrl\n        duration\n        tags\n        studios\n        episodes\n        animeStatus\n        rating\n        createdAt\n        updatedAt\n        startDate\n        endDate\n        broadcast\n        ranking\n        }\n    }\n": types.GetAnimeDetailsByIdDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    query getHomePageData($limit: Int) {\n        topRatedAnime(limit: $limit) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodes\n            animeStatus\n            imageUrl\n            rating\n            startDate\n        }\n        mostPopularAnime(limit: $limit) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodes\n            animeStatus\n            imageUrl\n            rating\n            startDate\n        }\n        newestAnime(limit:100) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodes\n            animeStatus\n            imageUrl\n            rating\n            startDate\n        }\n    }\n"): (typeof documents)["\n    query getHomePageData($limit: Int) {\n        topRatedAnime(limit: $limit) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodes\n            animeStatus\n            imageUrl\n            rating\n            startDate\n        }\n        mostPopularAnime(limit: $limit) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodes\n            animeStatus\n            imageUrl\n            rating\n            startDate\n        }\n        newestAnime(limit:100) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodes\n            animeStatus\n            imageUrl\n            rating\n            startDate\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    query getAnimeDetailsByID($id: ID!) {\n    \tanime(id: $id) {\n        id\n        anidbid\n        titleEn\n        titleJp\n        titleKanji\n        titleRomaji\n        titleSynonyms\n        description\n        imageUrl\n        duration\n        tags\n        studios\n        episodes\n        animeStatus\n        rating\n        createdAt\n        updatedAt\n        startDate\n        endDate\n        broadcast\n        ranking\n        }\n    }\n"): (typeof documents)["\n    query getAnimeDetailsByID($id: ID!) {\n    \tanime(id: $id) {\n        id\n        anidbid\n        titleEn\n        titleJp\n        titleKanji\n        titleRomaji\n        titleSynonyms\n        description\n        imageUrl\n        duration\n        tags\n        studios\n        episodes\n        animeStatus\n        rating\n        createdAt\n        updatedAt\n        startDate\n        endDate\n        broadcast\n        ranking\n        }\n    }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;