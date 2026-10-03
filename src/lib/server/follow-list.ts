import type { Cookies } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { cookieHeaderFrom, createSSRGraphQLClient, isNotFoundError, makeSSRFetcher, publicAuth } from '$lib/server/ssr-graphql';
import { getUserByUsername, queryFollowers, queryFollowing } from '$lib/services/api/graphql/queries';

export const FOLLOW_LIST_PAGE_SIZE = 30;

/**
 * The loader shared by /u/<name>/followers and /u/<name>/following: resolve
 * the user, then one page of the list. The request carries the viewer's
 * cookies, so an approval-required account answers with names only for its
 * followers -- the server, not the markup, decides what is shown.
 */
export async function loadFollowList(
  kind: 'followers' | 'following',
  { params, locals, cookies, url }: { params: { username: string }; locals: App.Locals; cookies: Cookies; url: URL },
) {
  const { auth, config } = locals;
  const cookieHeader = cookieHeaderFrom(cookies);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

  let user: any = null;
  try {
    const client = createSSRGraphQLClient(config.graphql_host, cookieHeader);
    const res: any = await client.request(getUserByUsername, { username: params.username });
    user = res?.userByUsername ?? null;
  } catch (err: any) {
    if (isNotFoundError(err)) error(404, 'No such user');
    console.error('[SSR] Failed to fetch public user:', err);
    error(503, 'Unable to load this profile right now');
  }
  if (!user) error(404, 'No such user');

  const fetcher = makeSSRFetcher(config.graphql_host, cookieHeader);
  const document = kind === 'followers' ? queryFollowers : queryFollowing;
  const result: any = await fetcher.fetchWithFallback(document, { userID: user.id, page, limit: FOLLOW_LIST_PAGE_SIZE }, kind);
  const list = result?.[kind] ?? { page, limit: FOLLOW_LIST_PAGE_SIZE, total: 0, users: [] };

  // An approval-required account hides names from non-followers: the page
  // comes back empty with a true total. That is the signal the view uses.
  const hidden = !!user.followApprovalRequired && list.users.length === 0 && Number(list.total) > 0;

  return {
    auth: publicAuth(auth),
    user,
    kind,
    list: { ...list, users: list.users ?? [] },
    page,
    hidden,
  };
}
