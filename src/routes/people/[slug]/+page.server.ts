import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { queryStaffByID, queryStaffBySlug } from '../../../services/api/graphql/queries';
import { createSSRGraphQLClient, cookieHeaderFrom, isNotFoundError } from '$lib/server/ssr-graphql';

/** A v4 UUID, i.e. this route was reached with an id rather than a slug. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params, url, locals, cookies }) => {
  const { slug } = params;

  if (!slug) {
    redirect(302, '/');
  }

  const { config } = locals;

  let staff: any = null;
  let loadError: string | null = null;
  let canonicalSlug: string | null = null;

  try {
    // The same cookie-forwarding client every other SSR route uses. Nothing on
    // this page is user-scoped today, but the client is shared so that adding a
    // user-scoped field later does not silently return null the way an
    // unauthenticated fetch would.
    const client = createSSRGraphQLClient(config.graphql_host, cookieHeaderFrom(cookies));

    // Accepts an id as well as a slug, for the reason the anime route does: the
    // id is the only address that always exists. Slugs are derived from a name,
    // so a staff member whose name reduces to nothing a URL can carry has none,
    // and every link falls back to the id.
    if (UUID.test(slug)) {
      const response: any = await client.request(queryStaffByID, { id: slug });
      staff = response?.staff ?? null;
      // Once a slug exists it is the canonical URL, so the id form redirects
      // rather than serving one person under two addresses.
      //
      // Recorded rather than thrown here: SvelteKit implements redirect() by
      // throwing, and the catch below would swallow it and render an error page
      // instead. It is issued after the try.
      if (staff?.slug) {
        canonicalSlug = staff.slug;
      }
    } else {
      const response: any = await client.request(queryStaffBySlug, { slug });
      staff = response?.staffBySlug ?? null;
    }
  } catch (err: any) {
    if (isNotFoundError(err)) {
      error(404, 'Voice actor not found');
    }
    console.error('[SSR] Failed to fetch staff data:', err);
    loadError = err?.message || 'Failed to fetch voice actor';
  }

  if (canonicalSlug) {
    // Carry the query string over; dropping it silently changes the page the
    // reader asked for.
    redirect(301, `/people/${canonicalSlug}${url.search}`);
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
    // The canonical address for this person: the slug where they have one, the
    // id otherwise. Used for the canonical tag and the breadcrumb, both of which
    // must agree with the URL that actually serves the page.
    staffPath: staff?.slug || slug,
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
