import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAnimeNewsByID, getAnimeNewsBySlug } from '../../../../services/api/graphql/queries';
import { createSSRGraphQLClient, cookieHeaderFrom, isNotFoundError } from '$lib/server/ssr-graphql';

/** A v4 UUID, i.e. reached with an id rather than a slug. See ../+page.server.ts. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params, url, locals, cookies }) => {
  const { slug } = params;

  if (!slug) {
    redirect(302, '/');
  }

  const { config } = locals;

  try {
    // Same cookie-forwarding client the show page uses — the gateway
    // authenticates by cookie, not a Bearer header.
    const client = createSSRGraphQLClient(config.graphql_host, cookieHeaderFrom(cookies));
    // Accepts an id as well, for the same reason the detail route does: an
    // anime without a slug yet must still be reachable from its own links.
    let anime: any;
    if (UUID.test(slug)) {
      const byId: any = await client.request(getAnimeNewsByID, { id: slug });
      anime = byId?.anime;
      if (anime?.slug) {
        redirect(301, `/anime/${anime.slug}/news${url.search}`);
      }
    } else {
      const response: any = await client.request(getAnimeNewsBySlug, { slug });
      anime = response?.animeBySlug;
    }
    if (!anime) {
      error(404, 'Anime not found');
    }

    const title = anime.titleEn || anime.titleJp || 'Anime';

    return {
      animeId: anime.id,
      animeSlug: slug,
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
      // is a portrait poster served under tags declaring 1200x630. /og/<id> returns a
      // correctly sized image from our own CDN, with a real fallback. No query string —
      // robots.txt disallows /*?*, which would hide it from the crawlers that need it.
      animeImage: `/og/${encodeURIComponent(anime.id)}`,
      news: anime.news ?? [],
      ssrError: null as string | null
    };
  } catch (e: any) {
    // A 404 thrown above arrives here as a SvelteKit HttpError — rethrow it
    // rather than reporting a missing anime as a load failure.
    if (e?.status) throw e;
    // The `!anime` check above never actually fires: the router reports a missing
    // record by throwing a DOWNSTREAM_SERVICE_ERROR, not by returning null. Without
    // this the page answered 200 for any bogus id — a soft 404.
    if (isNotFoundError(e)) error(404, 'Anime not found');
    return {
      animeId: '',
      animeSlug: slug,
      animeTitle: 'Anime',
      animeTitleJp: null as string | null,
      anime: null as any,
      animeImage: '/assets/og-image.jpg',
      news: [] as any[],
      ssrError: e?.message ?? 'Failed to load news'
    };
  }
};
