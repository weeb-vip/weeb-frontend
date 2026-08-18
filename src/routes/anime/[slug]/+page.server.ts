import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
// use the same typed documents the client uses — a raw copy here drifts
// (it already had: missing userAnime.episodes)
import {
  getAnimeDetailsByID,
  getAnimeDetailsBySlug,
  queryCharactersAndStaffByAnimeID
} from '../../../services/api/graphql/queries';
import { createSSRGraphQLClient, cookieHeaderFrom, isNotFoundError } from '$lib/server/ssr-graphql';
import { metaDescription } from '$lib/meta';

/** A v4 UUID, i.e. this route was reached with an id rather than a slug. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
  const { slug } = params;

  if (!slug) {
    redirect(302, '/');
  }

  const { config } = locals;

  let animeTitle = 'Anime Details';
  let animeDescription = 'View anime details, episodes, and information';
  let animeImage = '/assets/og-image.jpg';
  let animeData: any = null;
  let charactersData: any = null;
  // Not named `error`: that would shadow SvelteKit's error() helper imported above.
  let loadError: string | null = null;
  let error404 = false;
  let animeId = '';

  try {
    // Forward the user's cookies — the gateway authenticates via cookie,
    // not a Bearer header. A server-side fetch with credentials:'include'
    // forwards NO cookie, so the old Bearer-only client got userAnime:null
    // and every show rendered as "not on list" even when it was.
    const client = createSSRGraphQLClient(config.graphql_host, cookieHeaderFrom(cookies));

    // Characters are keyed by anime id, which only this lookup can give us, so
    // the two requests cannot be issued in parallel.
    //
    // This route accepts an id as well as a slug. Anime always have an id but
    // only have a slug once CDC has carried it through to MySQL, so resolving
    // by id too is what stops a freshly added anime -- or a whole environment
    // that has not been backfilled -- from having unreachable pages. Without
    // it the fallbacks are circular: no slug means links point at /show/<id>,
    // which itself can only redirect if a slug exists.
    if (UUID.test(slug)) {
      const byId: any = await client.request(getAnimeDetailsByID, { id: slug });
      const found = byId?.anime;
      // Once a slug exists it is the canonical URL, so send the id form there
      // rather than serving the same page under two addresses.
      if (found?.slug) {
        redirect(301, `/anime/${found.slug}`);
      }
      animeData = found ? { anime: found } : null;
    } else {
      const animeResponse: any = await client.request(getAnimeDetailsBySlug, { slug });
      animeData = animeResponse?.animeBySlug ? { anime: animeResponse.animeBySlug } : null;
    }

    if (animeData?.anime) {
      const anime = animeData.anime;
      animeId = anime.id;
      charactersData = await client
        .request(queryCharactersAndStaffByAnimeID, { animeId: anime.id })
        // Characters are supporting detail; losing them must not take the page
        // down when the main record loaded fine.
        .catch(() => null);

      animeTitle = anime.titleEn || anime.titleJp || 'Anime Details';
      // metaDescription rather than a raw substring: synopses are multi-paragraph, so
      // the old `substring(0, 160) + '...'` put raw newlines in the tag and cut
      // mid-word.
      animeDescription =
        metaDescription(anime.description) ??
        `Watch and track ${animeTitle} episodes, get notifications, and manage your anime watchlist on WeebVIP.`;

      // Not anime.imageUrl: that is a MyAnimeList address, and wrapping it in the CDN
      // prefix produced a 404 for every anime. /og/<id> resolves the banner, then the
      // poster, then the site default, and always answers. No query string — robots.txt
      // disallows /*?*, which would hide it from the crawlers that need it.
      animeImage = `/og/${encodeURIComponent(anime.id)}`;
    }
    // The query succeeded and there is no such anime: a genuine 404. This used to
    // return 200 with the placeholder title above, a soft 404 — which means every
    // stale or mistyped slug in the 32,000-URL sitemap could be indexed as an empty
    // page competing with real ones.
    //
    // Guarded on the request having actually succeeded. A gateway blip must not be
    // reported as "gone", or Google would start dropping real pages; that case still
    // falls through to the catch and renders with ssrError, where the client can
    // recover on hydration.
    if (!animeData?.anime) {
      error404 = true;
    }
  } catch (err: any) {
    // A missing anime arrives here as a thrown DOWNSTREAM_SERVICE_ERROR, not as a
    // null field, so it has to be separated from a genuine gateway failure.
    if (isNotFoundError(err)) {
      error404 = true;
    } else {
      console.error('[SSR] Failed to fetch anime data:', err);
      loadError = err?.message || 'Failed to fetch anime data';
    }
  }

  if (error404) {
    error(404, 'Anime not found');
  }

  return {
    animeId,
    animeSlug: slug,
    animeTitle,
    animeDescription,
    animeImage,
    // The subset the JSON-LD builder needs. Passed explicitly rather than reaching
    // into ssrAnimeData from the component, so the schema does not silently break
    // if the query's shape changes.
    animeSchemaSource: animeData?.anime
      ? {
          titleEn: animeData.anime.titleEn,
          titleJp: animeData.anime.titleJp,
          titleRomaji: animeData.anime.titleRomaji,
          description: animeData.anime.description,
          episodeCount: animeData.anime.episodeCount,
          startDate: animeData.anime.startDate,
          endDate: animeData.anime.endDate,
          duration: animeData.anime.duration,
          tags: animeData.anime.tags,
          studios: animeData.anime.studios,
          malId: animeData.anime.malId
        }
      : null,
    ssrAnimeData: animeData,
    ssrCharactersData: charactersData,
    ssrError: loadError
  };
};
