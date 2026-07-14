import type { LayoutServerLoad } from './$types';
import { publicAuth } from '$lib/server/ssr-graphql';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    // never return locals.auth directly: load data is serialized into the
    // page HTML, and it carries the raw jwt + refresh token
    auth: publicAuth(locals.auth),
    config: locals.config
  };
};
