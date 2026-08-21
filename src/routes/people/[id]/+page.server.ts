import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { queryStaffByID } from '../../../services/api/graphql/queries';
import { createSSRGraphQLClient, cookieHeaderFrom, isNotFoundError } from '$lib/server/ssr-graphql';

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
  const { id } = params;

  if (!id) {
    redirect(302, '/');
  }

  const { config } = locals;

  let staff: any = null;
  let loadError: string | null = null;

  try {
    // The same cookie-forwarding client every other SSR route uses. Nothing on
    // this page is user-scoped today, but the client is shared so that adding a
    // "characters you're following" style field later does not silently return
    // null the way an unauthenticated fetch would.
    const client = createSSRGraphQLClient(config.graphql_host, cookieHeaderFrom(cookies));
    const response: any = await client.request(queryStaffByID, { id });
    staff = response?.staff ?? null;
  } catch (err: any) {
    if (isNotFoundError(err)) {
      error(404, 'Voice actor not found');
    }
    console.error('[SSR] Failed to fetch staff data:', err);
    loadError = err?.message || 'Failed to fetch voice actor';
  }

  // A successful query with no staff member is a real 404. Distinguished from
  // the gateway failing, which falls through to ssrError above and renders --
  // reporting a transient outage as "gone" is what gets pages deindexed.
  if (!loadError && !staff) {
    error(404, 'Voice actor not found');
  }

  const name = staff ? `${staff.givenName} ${staff.familyName}`.trim() : 'Voice actor';
  const roleCount = staff?.roles?.length ?? 0;
  const animeCount = staff?.roles
    ? new Set(staff.roles.filter((r: any) => r.anime).map((r: any) => r.anime.id)).size
    : 0;

  return {
    staffId: id,
    staffName: name,
    // Written from the counts rather than the (usually empty) scraped summary,
    // so every one of these pages has a description that says something.
    staffDescription: roleCount
      ? `${name} has voiced ${roleCount} character${roleCount === 1 ? '' : 's'} across ${animeCount} anime. See the full list of roles on WeebVIP.`
      : `Roles and credits for ${name} on WeebVIP.`,
    staff,
    ssrError: loadError
  };
};
