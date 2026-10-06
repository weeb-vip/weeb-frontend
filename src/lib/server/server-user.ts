import type { ServerUser } from "$lib/stores/server-auth";
import { queryUserDetails } from "$lib/services/api/graphql/queries";

/** What one SSR fetch looks like to this module: `makeSSRFetcher`'s method. */
export type FetchDocument = (
  query: any,
  variables: any,
  description: string,
) => Promise<any>;

/**
 * The signed-in visitor's own record, for the first render of the header.
 *
 * The server already knows from the cookies that someone is signed in, but
 * without their record the HTML carried a pulsing skeleton where the avatar
 * goes, and a visitor without JavaScript kept it forever. One `UserDetails`
 * round trip per server render fills it. Only the fields the account slot
 * reads are returned, since load data ends up in the page HTML; any failure
 * is a null, and the client query fills the slot as before.
 */
export async function loadServerUser(
  fetchDocument: FetchDocument,
  isLoggedIn: boolean,
): Promise<ServerUser | null> {
  if (!isLoggedIn) return null;
  const result: any = await fetchDocument(queryUserDetails, {}, "user details");
  const user = result?.UserDetails;
  if (!user?.id || !user?.username) return null;
  return {
    id: String(user.id),
    username: String(user.username),
    firstname: user.firstname ?? "",
    lastname: user.lastname ?? "",
    profileImageUrl: user.profileImageUrl ?? null,
  };
}
