import { redirect } from '@sveltejs/kit';
import { GraphQLClient } from 'graphql-request';
import type { PageServerLoad } from './$types';

// Full anime details query (same as client-side)
const animeDetailsQuery = `
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
`;

const charactersQuery = `
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
`;

export const load: PageServerLoad = async ({ params, locals }) => {
  const { id } = params;

  if (!id) {
    redirect(302, '/');
  }

  const { auth, config } = locals;

  let animeTitle = 'Anime Details';
  let animeDescription = 'View anime details, episodes, and information';
  let animeImage = '/assets/og-image.jpg';
  let animeData: any = null;
  let charactersData: any = null;
  let error: string | null = null;

  try {
    const client = new GraphQLClient(config.graphql_host, {
      headers: {
        ...(auth.authToken && { Authorization: `Bearer ${auth.authToken}` })
      },
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        return fetch(input, {
          ...init,
          credentials: 'include'
        });
      }
    });

    const [animeResponse, charactersResponse] = await Promise.all([
      client.request(animeDetailsQuery, { id }),
      client.request(charactersQuery, { animeId: id })
    ]);

    animeData = animeResponse;
    charactersData = charactersResponse;

    if (animeData?.anime) {
      const anime = animeData.anime;
      animeTitle = anime.titleEn || anime.titleJp || 'Anime Details';
      animeDescription = anime.description
        ? `${anime.description.substring(0, 160)}...`
        : `Watch and track ${animeTitle} episodes, get notifications, and manage your anime watchlist on WeebVIP.`;

      if (anime.imageUrl) {
        animeImage = `https://cdn.weeb.vip/weeb/${encodeURIComponent(anime.imageUrl)}`;
      }
    }
  } catch (err: any) {
    console.error('[SSR] Failed to fetch anime data:', err);
    error = err?.message || 'Failed to fetch anime data';
  }

  return {
    animeId: id,
    animeTitle,
    animeDescription,
    animeImage,
    ssrAnimeData: animeData,
    ssrCharactersData: charactersData,
    ssrError: error
  };
};
