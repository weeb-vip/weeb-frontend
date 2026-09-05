import type { Preview } from "storybook";
import '../src/styles/design-tokens.css';
import '../src/scss/base.scss';
import { configStore } from '../src/svelte/stores/config';
import type { IConfig } from '../src/config/interfaces';

/**
 * The app's config, supplied up front.
 *
 * `configStore.init()` returns immediately once the store holds a value and
 * only falls back to `fetch('/config.json')` when nothing has populated it --
 * which in Storybook was every component that reads config: the avatars for
 * their CDN base, the header's search box for its index names. Hydrating here
 * is the same thing the root layout does in the app, and it is what keeps a
 * story from going to the network to draw itself.
 */
configStore.hydrate({
  api_host: 'https://api.storybook.invalid',
  graphql_host: 'https://api.storybook.invalid/graphql',
  algolia_index: 'anime-storybook',
  algolia_works_index: 'works-storybook',
  cdn_url: 'https://cdn.weeb.vip',
  cdn_user_url: 'https://cdn.weeb.vip/users',
  environment: 'local',
} satisfies IConfig);

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'weeb-dark',
      values: [
        { name: 'weeb-dark', value: 'oklch(14% 0.015 275)' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    /**
     * A page store for every story.
     *
     * The `Pages/*` stories mount the route's own `+page.svelte` -- the route
     * file *is* the page now -- so each of them renders `Seo`, which reads
     * `$page.url` for the request origin and the canonical path. The SvelteKit
     * framework mock leaves that store empty unless a story fills it, and an
     * empty one throws on `.url`. A site-root default keeps every story
     * rendering; the ones whose canonical URL is worth reading override
     * `sveltekit_experimental.stores.page` with their own.
     */
    sveltekit_experimental: {
      stores: {
        page: {
          url: new URL('https://weeb.vip/'),
          params: {},
          route: { id: null },
          status: 200,
          error: null,
          data: {},
          form: null,
        },
      },
    },
    // The sidebar follows the architecture rather than the alphabet:
    // Primitives (no domain vocabulary, composable anywhere), then Composites
    // (domain surfaces built from them, grouped by the area they belong to),
    // then Pages (whole routes, driven by their page bloc).
    options: {
      storySort: {
        order: ['Primitives', 'Composites', 'Pages'],
      },
    },
  },
};

export default preview;
