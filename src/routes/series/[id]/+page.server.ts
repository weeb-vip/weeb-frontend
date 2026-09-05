import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAnimeBySeriesId } from '../../../services/api/graphql/queries';
import { createSSRGraphQLClient, cookieHeaderFrom, isNotFoundError } from '$lib/server/ssr-graphql';

/**
 * Everything MyAnimeList files separately that TheTVDB keeps as one series.
 *
 * The URL is /series/<thetvdbid>-<slug> and only the leading digits are read.
 * A series has no name of its own in our data -- TheTVDB's series records carry
 * no MyAnimeList id, and we store nothing but the number -- so the readable
 * half of the URL is borrowed from whichever entry opens the series. Borrowing
 * something mutable to build a permanent URL is only safe if the URL does not
 * depend on it, which is why the slug is never parsed and never has to match.
 */
export const load: PageServerLoad = async ({ params, locals, cookies }) => {
  const { config } = locals;

  const seriesId = (params.id.match(/^(\d+)/) || [])[1];
  if (!seriesId) {
    error(404, 'Not found');
  }

  let entries: any[] = [];
  let loadError: string | null = null;

  try {
    const client = createSSRGraphQLClient(config.graphql_host, cookieHeaderFrom(cookies));
    const result: any = await client.request(getAnimeBySeriesId, { id: seriesId });
    entries = result?.animeBySeriesId ?? [];
  } catch (err: any) {
    if (isNotFoundError(err)) {
      entries = [];
    } else {
      console.error('[SSR] Failed to fetch series:', err);
      loadError = err?.message || 'Failed to fetch series';
    }
  }

  // A series id nothing claims is a 404. There is no such thing as an empty
  // series: the id only exists because at least one anime carries it.
  if (entries.length === 0 && !loadError) {
    error(404, 'Not found');
  }

  // The entry that gives the series its name. The earliest broadcast run, since
  // that is what people call the series -- "Re:ZERO", not the name of whichever
  // special happens to be oldest. Falls back to the earliest of anything when a
  // series has no TV entry at all, which is common for OVA and ONA runs.
  const byDate = [...entries].sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });
  const anchor = byDate.find((e) => (e.type || '').toLowerCase() === 'tv') || byDate[0];
  const title = anchor?.titleEn || anchor?.titleJp || 'Series';

  return {
    seriesId,
    seriesTitle: title,
    seriesSlug: anchor?.slug ?? null,
    seriesDescription: `Every entry in ${title} — seasons, specials and films, in order.`,
    seriesImage: anchor?.imageUrl || '/assets/og-image.jpg',
    ssrEntries: entries,
    ssrError: loadError
  };
};
