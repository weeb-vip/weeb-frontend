import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
// use the same typed documents the client uses — a raw copy here drifts
// (it already had: missing userAnime.episodes)
import { getAnimeDetailsByID, queryCharactersAndStaffByAnimeID } from '../../../services/api/graphql/queries';
import { createSSRGraphQLClient, cookieHeaderFrom } from '$lib/server/ssr-graphql';

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
  const { id } = params;

  if (!id) {
    redirect(302, '/');
  }

  const { config } = locals;

  let animeTitle = 'Anime Details';
  let animeDescription = 'View anime details, episodes, and information';
  let animeImage = '/assets/og-image.jpg';
  let animeData: any = null;
  let charactersData: any = null;
  let error: string | null = null;

  try {
    // Forward the user's cookies — the gateway authenticates via cookie,
    // not a Bearer header. A server-side fetch with credentials:'include'
    // forwards NO cookie, so the old Bearer-only client got userAnime:null
    // and every show rendered as "not on list" even when it was.
    const client = createSSRGraphQLClient(config.graphql_host, cookieHeaderFrom(cookies));

    const [animeResponse, charactersResponse] = await Promise.all([
      client.request(getAnimeDetailsByID, { id }),
      client.request(queryCharactersAndStaffByAnimeID, { animeId: id })
    ]);

    animeData = animeResponse;
    charactersData = charactersResponse;

    if (animeData?.anime) {
      const anime = animeData.anime;
      animeTitle = anime.titleEn || anime.titleJp || 'Anime Details';
      animeDescription = anime.description
        ? `${anime.description.substring(0, 160)}...`
        : `Watch and track ${animeTitle} episodes, get notifications, and manage your anime watchlist on WeebVIP.`;

      // Not anime.imageUrl: that is a MyAnimeList address, and wrapping it in the CDN
      // prefix produced a 404 for every anime. /og/<id> resolves the banner, then the
      // poster, then the site default, and always answers. No query string — robots.txt
      // disallows /*?*, which would hide it from the crawlers that need it.
      animeImage = `/og/${encodeURIComponent(id)}`;
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
