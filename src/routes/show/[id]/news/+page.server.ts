import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAnimeSlugByID } from '../../../../services/api/graphql/queries';
import { createSSRGraphQLClient, cookieHeaderFrom, isNotFoundError } from '$lib/server/ssr-graphql';

/** Legacy URL. See ../+page.server.ts for why this is a permanent redirect. */
export const load: PageServerLoad = async ({ params, url, locals, cookies }) => {
  const { id } = params;

  if (!id) {
    redirect(302, '/');
  }

  const { config } = locals;
  const client = createSSRGraphQLClient(config.graphql_host, cookieHeaderFrom(cookies));

  let anime: { id: string; slug?: string | null } | null = null;

  try {
    const res: any = await client.request(getAnimeSlugByID, { id });
    anime = res?.anime ?? null;
  } catch (err: any) {
    if (isNotFoundError(err)) {
      error(404, 'Anime not found');
    }
    console.error('[SSR] Failed to resolve anime slug:', err);
    error(503, 'Unable to resolve this anime right now');
  }

  if (!anime) {
    error(404, 'Anime not found');
  }
  // Prefer the slug, fall back to the id: /anime/<id> resolves too, and
  // redirects on to the slug once MySQL has it. Erroring here when the slug has
  // not landed yet would make a brand-new anime unreachable from its own links.
  redirect(301, `/anime/${anime.slug ?? encodeURIComponent(anime.id)}/news${url.search}`);
};
