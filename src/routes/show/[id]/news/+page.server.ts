import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAnimeNewsByID } from '../../../../services/api/graphql/queries';
import { createSSRGraphQLClient, cookieHeaderFrom } from '$lib/server/ssr-graphql';

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
  const { id } = params;

  if (!id) {
    redirect(302, '/');
  }

  const { config } = locals;

  try {
    // Same cookie-forwarding client the show page uses — the gateway
    // authenticates by cookie, not a Bearer header.
    const client = createSSRGraphQLClient(config.graphql_host, cookieHeaderFrom(cookies));
    const response: any = await client.request(getAnimeNewsByID, { id });

    const anime = response?.anime;
    if (!anime) {
      error(404, 'Anime not found');
    }

    const title = anime.titleEn || anime.titleJp || 'Anime';

    return {
      animeId: id,
      animeTitle: title,
      // Shown under the title in the hero, so the page identifies the anime on its own
      // when reached from a shared link.
      animeTitleJp: anime.titleJp && anime.titleJp !== title ? anime.titleJp : null,
      // The whole anime, so the page can build poster/banner URLs the same way the show
      // page does — via GetImageFromAnime, which returns a CDN *slug*, not a URL.
      // Passing anime.imageUrl here was the bug: that's a MyAnimeList address the CDN
      // knows nothing about.
      anime,
      // og:image. Hotlinking anime.imageUrl to MyAnimeList did render a card, but it
      // is a portrait poster served under tags declaring 1200x630. /og/<id>.jpg
      // returns a correctly sized image from our own CDN, with a real fallback.
      animeImage: `/og/${encodeURIComponent(id)}?t=${encodeURIComponent(title)}`,
      news: anime.news ?? [],
      ssrError: null as string | null
    };
  } catch (e: any) {
    // A 404 thrown above arrives here as a SvelteKit HttpError — rethrow it
    // rather than reporting a missing anime as a load failure.
    if (e?.status) throw e;
    return {
      animeId: id,
      animeTitle: 'Anime',
      animeTitleJp: null as string | null,
      anime: null as any,
      animeImage: '/assets/og-image.jpg',
      news: [] as any[],
      ssrError: e?.message ?? 'Failed to load news'
    };
  }
};
