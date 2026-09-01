import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { makeSSRFetcher, publicAuth, cookieHeaderFrom } from '$lib/server/ssr-graphql';
import {
  getUserByUsername,
  queryPublicUserAnimes,
  queryPublicUserWorks,
  queryPublicUserAnimeStatusCounts,
  queryPublicUserWorkStatusCounts
} from '../../../services/api/graphql/queries';
import { Status, WorkStatus } from '../../../gql/graphql';

// The public page for any user, at /u/<username>. The header is always public;
// the lists are fetched here only when the viewed user has opted them public,
// so a private profile never leaves this loader with list data attached -- the
// gate lives on the server, not in the markup.
export const load: PageServerLoad = async ({ params, locals, cookies }) => {
  const { auth, config } = locals;
  const cookieHeader = cookieHeaderFrom(cookies);
  const fetcher = makeSSRFetcher(config.graphql_host, cookieHeader);

  const username = params.username;
  const userRes = await fetcher.fetchWithFallback(
    getUserByUsername,
    { username },
    'public user'
  );
  const user = (userRes as any)?.userByUsername ?? null;
  if (!user) {
    throw error(404, 'No such user');
  }

  // Usernames resolve case-insensitively, so /u/ThatCat and /u/THATCAT both
  // find the same person. Normalise the address to the one canonical casing the
  // user actually chose, so a page has a single URL rather than one per casing.
  // Done before the lists load below, so a redirect never pays for fetches the
  // canonical request will redo.
  if (user.username && username !== user.username) {
    throw redirect(308, `/u/${encodeURIComponent(user.username)}`);
  }

  // Only the current statuses ride the page as full rows; the rest of the
  // library shows as counts, so those queries never pull the entries behind
  // the numbers.
  let lists: {
    watching: any;
    reading: any;
    animeCounts: any;
    workCounts: any;
  } | null = null;

  if (user.listsPublic) {
    const [watching, reading, animeCounts, workCounts] = await Promise.all([
      fetcher.fetchWithFallback(
        queryPublicUserAnimes,
        { userID: user.id, input: { status: Status.Watching, limit: 60, page: 1 } },
        'public watching'
      ),
      fetcher.fetchWithFallback(
        queryPublicUserWorks,
        { userID: user.id, input: { status: WorkStatus.Reading, limit: 60, page: 1 } },
        'public reading'
      ),
      fetcher.fetchWithFallback(
        queryPublicUserAnimeStatusCounts,
        { userID: user.id },
        'public anime counts'
      ),
      fetcher.fetchWithFallback(
        queryPublicUserWorkStatusCounts,
        { userID: user.id },
        'public work counts'
      )
    ]);
    lists = {
      watching: (watching as any)?.PublicUserAnimes ?? null,
      reading: (reading as any)?.PublicUserWorks ?? null,
      animeCounts: (animeCounts as any)?.PublicUserAnimeStatusCounts ?? null,
      workCounts: (workCounts as any)?.PublicUserWorkStatusCounts ?? null
    };
  }

  return {
    auth: publicAuth(auth),
    user,
    lists
  };
};
