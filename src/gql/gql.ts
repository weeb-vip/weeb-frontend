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
    "\n    query getHomePageData($limit: Int) {\n        topRatedAnime(limit: $limit) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodeCount\n            animeStatus\n            imageUrl\n            rating\n            startDate\n            ranking\n        }\n        mostPopularAnime(limit: $limit) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodeCount\n            animeStatus\n            imageUrl\n            rating\n            startDate\n            ranking\n        }\n        newestAnime(limit:100) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodeCount\n            animeStatus\n            imageUrl\n            rating\n            startDate\n            ranking\n        }\n    }\n": types.GetHomePageDataDocument,
    "\n    query getAnimeDetailsByID($id: ID!) {\n    \tanime(id: $id) {\n            id\n            anidbid\n            titleEn\n            titleJp\n            titleRomaji\n            titleKanji\n            titleSynonyms\n            description\n            imageUrl\n            tags\n            studios\n            animeStatus\n            episodeCount\n            episodes {\n              id\n              animeId\n              episodeNumber\n              titleEn\n              titleJp\n              synopsis\n              airDate\n              createdAt\n              updatedAt\n            }\n            duration\n            rating\n            startDate\n            endDate\n            broadcast\n            source\n            licensors\n            ranking\n            createdAt\n            updatedAt\n          }\n    }\n": types.GetAnimeDetailsByIdDocument,
    "\n  query currentlyAiring {\n    currentlyAiring {\n      id\n      titleEn\n      titleJp\n      endDate\n      startDate\n      imageUrl\n      duration\n      ranking\n      episodes {\n        airDate\n        titleEn\n      }\n    }\n  }\n": types.CurrentlyAiringDocument,
    "\n    mutation RefreshToken($token: String!) {\n        RefreshToken(token: $token) {\n            id\n            Credentials {\n                refresh_token\n                token\n            }\n        }\n    }\n": types.RefreshTokenDocument,
    "\n        mutation Register($input: RegisterInput!) {\n            Register(input: $input) {\n                id\n            }\n        }\n  ": types.RegisterDocument,
    "\n        mutation CreateSession($input: LoginInput!) {\n            CreateSession(input: $input) {\n                id\n                Credentials {\n                    refresh_token\n                    token\n                }\n            }\n        }\n  ": types.CreateSessionDocument,
    "\n    query getUserDetails {\n        UserDetails {\n            id\n            firstname\n            lastname\n            username\n            language\n            email\n            active_sessions {\n                id\n                ip_address\n                token\n                user_agent\n                user_id\n            }\n        }\n    }": types.GetUserDetailsDocument,
    "\n  mutation UpdateUserDetails($input: UpdateUserInput!) {\n    UpdateUserDetails(input: $input) {\n      id\n      firstname\n      lastname\n      username\n      language\n      email\n    }\n  }\n": types.UpdateUserDetailsDocument,
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
export function graphql(source: "\n    query getHomePageData($limit: Int) {\n        topRatedAnime(limit: $limit) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodeCount\n            animeStatus\n            imageUrl\n            rating\n            startDate\n            ranking\n        }\n        mostPopularAnime(limit: $limit) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodeCount\n            animeStatus\n            imageUrl\n            rating\n            startDate\n            ranking\n        }\n        newestAnime(limit:100) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodeCount\n            animeStatus\n            imageUrl\n            rating\n            startDate\n            ranking\n        }\n    }\n"): (typeof documents)["\n    query getHomePageData($limit: Int) {\n        topRatedAnime(limit: $limit) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodeCount\n            animeStatus\n            imageUrl\n            rating\n            startDate\n            ranking\n        }\n        mostPopularAnime(limit: $limit) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodeCount\n            animeStatus\n            imageUrl\n            rating\n            startDate\n            ranking\n        }\n        newestAnime(limit:100) {\n            id\n            anidbid\n            titleEn\n            imageUrl\n            duration\n            tags\n            episodeCount\n            animeStatus\n            imageUrl\n            rating\n            startDate\n            ranking\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    query getAnimeDetailsByID($id: ID!) {\n    \tanime(id: $id) {\n            id\n            anidbid\n            titleEn\n            titleJp\n            titleRomaji\n            titleKanji\n            titleSynonyms\n            description\n            imageUrl\n            tags\n            studios\n            animeStatus\n            episodeCount\n            episodes {\n              id\n              animeId\n              episodeNumber\n              titleEn\n              titleJp\n              synopsis\n              airDate\n              createdAt\n              updatedAt\n            }\n            duration\n            rating\n            startDate\n            endDate\n            broadcast\n            source\n            licensors\n            ranking\n            createdAt\n            updatedAt\n          }\n    }\n"): (typeof documents)["\n    query getAnimeDetailsByID($id: ID!) {\n    \tanime(id: $id) {\n            id\n            anidbid\n            titleEn\n            titleJp\n            titleRomaji\n            titleKanji\n            titleSynonyms\n            description\n            imageUrl\n            tags\n            studios\n            animeStatus\n            episodeCount\n            episodes {\n              id\n              animeId\n              episodeNumber\n              titleEn\n              titleJp\n              synopsis\n              airDate\n              createdAt\n              updatedAt\n            }\n            duration\n            rating\n            startDate\n            endDate\n            broadcast\n            source\n            licensors\n            ranking\n            createdAt\n            updatedAt\n          }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query currentlyAiring {\n    currentlyAiring {\n      id\n      titleEn\n      titleJp\n      endDate\n      startDate\n      imageUrl\n      duration\n      ranking\n      episodes {\n        airDate\n        titleEn\n      }\n    }\n  }\n"): (typeof documents)["\n  query currentlyAiring {\n    currentlyAiring {\n      id\n      titleEn\n      titleJp\n      endDate\n      startDate\n      imageUrl\n      duration\n      ranking\n      episodes {\n        airDate\n        titleEn\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    mutation RefreshToken($token: String!) {\n        RefreshToken(token: $token) {\n            id\n            Credentials {\n                refresh_token\n                token\n            }\n        }\n    }\n"): (typeof documents)["\n    mutation RefreshToken($token: String!) {\n        RefreshToken(token: $token) {\n            id\n            Credentials {\n                refresh_token\n                token\n            }\n        }\n    }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n        mutation Register($input: RegisterInput!) {\n            Register(input: $input) {\n                id\n            }\n        }\n  "): (typeof documents)["\n        mutation Register($input: RegisterInput!) {\n            Register(input: $input) {\n                id\n            }\n        }\n  "];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n        mutation CreateSession($input: LoginInput!) {\n            CreateSession(input: $input) {\n                id\n                Credentials {\n                    refresh_token\n                    token\n                }\n            }\n        }\n  "): (typeof documents)["\n        mutation CreateSession($input: LoginInput!) {\n            CreateSession(input: $input) {\n                id\n                Credentials {\n                    refresh_token\n                    token\n                }\n            }\n        }\n  "];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n    query getUserDetails {\n        UserDetails {\n            id\n            firstname\n            lastname\n            username\n            language\n            email\n            active_sessions {\n                id\n                ip_address\n                token\n                user_agent\n                user_id\n            }\n        }\n    }"): (typeof documents)["\n    query getUserDetails {\n        UserDetails {\n            id\n            firstname\n            lastname\n            username\n            language\n            email\n            active_sessions {\n                id\n                ip_address\n                token\n                user_agent\n                user_id\n            }\n        }\n    }"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateUserDetails($input: UpdateUserInput!) {\n    UpdateUserDetails(input: $input) {\n      id\n      firstname\n      lastname\n      username\n      language\n      email\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateUserDetails($input: UpdateUserInput!) {\n    UpdateUserDetails(input: $input) {\n      id\n      firstname\n      lastname\n      username\n      language\n      email\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;