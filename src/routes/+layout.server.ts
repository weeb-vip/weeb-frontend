import type { LayoutServerLoad } from "./$types";
import {
  cookieHeaderFrom,
  makeSSRFetcher,
  publicAuth,
} from "$lib/server/ssr-graphql";
import { loadServerUser } from "$lib/server/server-user";

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
  const auth = publicAuth(locals.auth);
  // The signed-in visitor's own record, so the header's account slot is in
  // the HTML rather than a skeleton the client fills. One round trip, only
  // for a signed-in request; a failure leaves it to the client as before.
  const user = auth.isLoggedIn
    ? await loadServerUser(
        makeSSRFetcher(locals.config.graphql_host, cookieHeaderFrom(cookies))
          .fetchWithFallback,
        true,
      )
    : null;
  return {
    // never return locals.auth directly: load data is serialized into the
    // page HTML, and it carries the raw jwt + refresh token
    auth: { ...auth, user },
    config: locals.config,
    saveData: locals.saveData === true,
  };
};
