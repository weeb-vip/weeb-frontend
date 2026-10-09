# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `yarn dev` - Start the Vite dev server (default port 5173)
- `yarn build` - Production build (`vite build`; does **not** type-check)
- `yarn preview` - Preview the production build on port 4321
- `yarn start` - Run the built server (`node build/index.js`)
- `yarn check` - Type-check with `svelte-check`
- `yarn check:gate` - Ratchet gate: fails if svelte-check errors/warnings exceed the committed baseline in `.svelte-check-baseline` (currently 0/0, so any new diagnostic fails)
- `yarn test` - Unit and component tests (Vitest, `jsdom`); `yarn test:watch` to re-run on change, `yarn test:coverage` for a v8 report in `coverage/`
- `yarn test:e2e` - End-to-end tests (Playwright); `tests/e2e/` is outside vitest's `include`, so `yarn test` never picks it up. A spec that needs a signed-in user imports `test` from `tests/e2e/account.fixture.ts`, which registers, verifies and signs in ONE account per worker and starts every page from its storage state; registering per test cost 30-90s each. Only a spec that needs its own user (token expiry, two people) registers itself. CI runs 3 workers per shard; nothing may depend on being alone on the server.
- `yarn storybook` - Storybook on port 6006

`packageManager` is yarn 4.13.0, but a `bun.lock` is committed and the Dockerfile builds with Bun. Keep both lockfiles in sync when changing dependencies.

## Testing

Unit and component tests run on **Vitest**, configured in the `test` block of
`vite.config.ts` rather than a standalone config, so they go through the same
Vite pipeline the app builds with. That is deliberate: `vite-plugin-svelte`
compiles `.svelte` components and `.svelte.ts` runes modules, so a bloc can be
imported into a test directly. Under the previous runner (ts-jest,
`testEnvironment: node`) neither would load.

- Tests are `src/**/*.test.ts`, beside the module they test. `tests/e2e/` is
  Playwright's and is outside vitest's `include`.
- Environment is `jsdom`. A file needing the no-`window` SSR branch opts out
  with a `@vitest-environment node` docblock.
- `globals: false` -- every test imports `describe`/`it`/`expect`/`vi` from
  `vitest`, so `svelte-check` type-checks the same symbols the runner injects.
- `vitest-setup.ts` registers the `@testing-library/jest-dom` matchers and
  `@testing-library/svelte`'s between-test cleanup (the latter is not automatic
  with `globals: false`).
- Component tests use `@testing-library/svelte` and query by accessible role.
  `src/lib/components/primitives/Button/Button.test.ts` is the reference.
- **Unit tests cover components; pages are covered by e2e.** A component is a
  unit with props in and DOM out; a `+page.svelte` is a composition plus a
  loader, and what matters about it is asserted by `tests/e2e` in a real
  browser. Do not write jsdom page tests to move a coverage number.
- Coverage is `@vitest/coverage-v8` (`yarn test:coverage`), and it enforces a
  threshold scoped to **`src/lib/components/**` at 80% statements** (branches
  70 / functions 75 / lines 80 -- those run structurally lower in a Svelte
  view). `src/routes/**` is unthresholded on purpose. Story support and test
  helpers (`__stories__/`, `*.stories.*`, `__tests__/`, `__fixtures__/`) are
  excluded from the denominator: none of it ships. The 80% is the standard the
  suites are written to -- a failing gate means another component suite, not a
  lower number in the config.
- `resolve.conditions` is set to `['browser']` only when `VITEST` is set --
  without it components would render through svelte's server export instead of
  mounting into jsdom.

## Debug Logging

Use the debug utility in `src/lib/utils/debug.ts` instead of console.log. All logs follow the format: `:emoji: :type:: :timestamp:: :message:`

```typescript
import debug from './utils/debug';

debug.info('General information');        // ℹ️ INFO: 14:32:15: General information
debug.warn('Warning message');           // ⚠️ WARN: 14:32:15: Warning message
debug.error('Error occurred');           // 🚨 ERROR: 14:32:15: Error occurred
debug.success('Operation completed!');   // ✅ SUCCESS: 14:32:15: Operation completed!
debug.auth('Authentication flow');       // 🔐 AUTH: 14:32:15: 🔒 ***MASKED***
debug.api('POST /api/login', response);  // 🌐 API: 14:32:15: POST /api/login 🔒 Response logged
debug.anime('Added to watchlist');      // 🍿 ANIME: 14:32:15: Added to watchlist
debug.log('Debug information');         // 🐛 DEBUG: 14:32:15: Debug information
```

**Features:**
- 🎯 **Consistent format** across all log types
- 🕐 **Automatic timestamps** in HH:MM:SS format
- 🔒 **Smart data masking** for sensitive information
- 📊 **Log levels** with environment-based filtering

**Environment Variables:**
- `VITE_DEBUG=true` - Enable debug logging in production
- `VITE_DEBUG_SENSITIVE=true` - Show sensitive data (tokens, etc)
- `VITE_LOG_LEVEL=debug|info|warn|error` - Set log level (default: info)

Note that `vite.config.ts` strips `console.log`/`debug`/`info` in production builds via terser `pure_funcs`. `console.error` and `console.warn` survive deliberately — they are the only production logging the k8s pods and workers emit.

## Architecture Overview

A **SvelteKit** application for an anime tracking platform:

- **SvelteKit 2** on **Vite 6** — build tool, dev server, SSR and routing
- **Svelte 5** with TypeScript
- **TailwindCSS 3** for styling, with SCSS for additional styles
- **TanStack Query** (`@tanstack/svelte-query`) for data fetching and caching
- **Svelte stores** for global state
- **Motion** for animations

> Historical note: this app was migrated from React, then from Astro. Comments and helper shims referencing either (for example the Astro-style cookie adapter in `src/hooks.server.ts`) are migration residue, not the current architecture. See `docs/ASTRO_MIGRATION.md`.

### Key Architectural Patterns

**Routing**: SvelteKit file-based routing under `src/routes/`. Server logic lives in `+page.server.ts` / `+server.ts`, layout in `+layout.svelte` and `+layout.server.ts`, errors in `+error.svelte`. There are no manually registered routes or layout components.

**Configuration System**: Environment configs live in `src/config/static/{development,local,production,staging}/index.json`. `vite-plugin-static-copy` copies the one selected by `APP_CONFIG` (falling back to `NODE_ENV`, then `development`) to `config.json` at build time. At runtime `src/config/index.ts` reads it off `global.config` / `window.config`, with a hardcoded staging fallback if absent; `src/config/build-time-loader.ts` is the server-side path. In k8s the file is replaced by a mounted ConfigMap, which is how one image serves multiple environments.

**Authentication**: Handled in `src/hooks.server.ts` — reads auth cookies, refreshes expired tokens server-side, and clears cookies when a refresh fails. Cookie names and attributes have a single source of truth in `src/lib/server/auth-cookies.ts`; they must match what the gateway and `ssr-token-refresh` set, or logout and refresh silently break. Client-side token access goes through `src/lib/utils/auth-storage.ts`. Login state is exposed via `src/lib/stores/auth.ts`.

**Data Layer**:
- GraphQL operations are generated by GraphQL Code Generator into `src/gql/` from the remote schema at `https://gateway.staging.weeb.vip/graphql` (see `codegen.ts`)
- REST calls live in `src/lib/services/api/`
- Query caching via TanStack Query

**Component Structure**: Everything shared lives under `src/lib/`, reached by SvelteKit's built-in `$lib` alias — there are no other path aliases. Components sit in `src/lib/components/<group>/`, where the groups (`primitives`, `cards`, `show`, `tracking`, `profile`, `home`, `auth`, `shell`, `pages`) mirror the Storybook sidebar; stores are in `src/lib/stores/`, composables in `src/lib/composables/`, actions in `src/lib/actions/`, shared helpers in `src/lib/utils/`, and the data layer in `src/lib/services/`. Static assets are served from `public/` (`kit.files.assets`).

**State Management**:
- Global state via Svelte stores in `src/lib/stores/`
- Server-fetched state via TanStack Query

### Build and Deployment

`svelte.config.js` selects an adapter by `DEPLOY_TARGET`:

- `DEPLOY_TARGET=cloudflare` → `@sveltejs/adapter-cloudflare` for Cloudflare Pages (`yarn deploy:staging` / `yarn deploy:production`, and the deploy-cloudflare workflow)
- otherwise → `@sveltejs/adapter-node` writing to `build/`, which is what the Docker image runs

See `docs/DEPLOYMENT.md` for the Cloudflare pipeline.

### Development Notes

- Vite `build.target` is **es2020** — set explicitly so the worker build isn't forced lower in CI, where esbuild can't downlevel some dependencies' destructuring.
- `optimizeDeps.exclude` lists packages that ship `.svelte` files. They can't be esbuild-prebundled and `vite dev` crashes on startup if they are.
- TypeScript is `strict` but with `noImplicitAny: false`.

Key pages:
- Home (`/`) - Main anime discovery
- Show detail (`/show/[id]`) - Individual anime details
- Currently Airing (`/airing`, `/airing/calendar`) - Seasonal anime calendar
- Season (`/season/[season]`)
- Search (`/search`)
- Profile (`/profile`, `/profile/anime`, `/profile/settings`)
- Social: public profile follow button, counts and recent activity (`/u/[username]`), follower lists (`/u/[username]/followers`, `/following`), the feed (`/feed`), follow requests on `/profile`, follow-approval toggle and notification preferences on `/profile/settings`, and the notifications bell in the header. Components live under `src/lib/components/profile/{FollowButton,FollowRequests,FollowList,NotificationPreferences}`, `src/lib/components/feed` and `src/lib/components/shell/NotificationsBell`.
- `codegen-pending.graphql` holds the follow/feed/notification schema until the staging gateway serves it; run `yarn graphql-codegen --config codegen.ts` after changing documents, and delete that file plus its entry in `codegen.ts` once the backend is deployed to staging.
- Settings (`/settings`), About (`/about`)
- Auth flows under `/auth/` (login, register, verification, password reset)
- Generated XML sitemaps and OG images (`/sitemap*.xml`, `/og/[id]`)

### First-paint contracts

These exist because the mobile LCP sat at 5-7s and no artwork rendered without JavaScript. Keep them when touching the pieces involved.

- `SafeImage` renders its first candidate as a real `<img>` on the server and walks the fallback chain from the element's own `error` event. Never gate artwork behind hydration, `onMount` or a probe; a page's hero must be in the HTML with `priority` (eager + `fetchpriority=high`), everything below the fold lazy. It reports `onChosen` even for an element the browser finished before hydration, so a fade gate must be opened by that callback and must be applied only after hydration (see `KeyArtStage`'s `bgOpacity`).
- The server has no viewport. Art that differs by viewport goes through `phoneSources` (a `<picture>` source on `PHONE_QUERY`), not through `isPhone` in a bloc, or phones download the desktop image and then the phone one. The home hero's preload hints (`heroPreloads` in `src/lib/components/home/HeroBanner/hero-art.ts`) carry the same media queries and must stay in step with `heroSources`/`heroPhoneSources`.
- `src/lib/server/rocket-loader.ts` marks SvelteKit's init script `data-cfasync="false"`. Cloudflare Rocket Loader is on for the zone and the `cf-rocket` meta does not stop it; without the attribute hydration waits on Cloudflare's deferred loader.
- `vite.config.ts` sets `cssCodeSplit: false` (one stylesheet, cached across pages, instead of 17 render-blocking links). Do not import icon-font stylesheets; icons are `svelte-fa`.
- Public pages that exist are listed in `CACHEABLE_ROUTES` in `src/hooks.server.ts` (the adapter stores only 200s, so a redirecting route there caches nothing).
- Auth on first render: the root layout hands `data.auth` down as a per-request Svelte context (`src/lib/stores/server-auth.ts`, never the module-level `loggedInStore`, which is shared across SSR requests). Anything that renders differently for a signed-in visitor resolves `isLoggedIn` through `resolveLoggedIn(store, serverAuth)`, so a signed-in server response is never rendered signed out. Cached anonymous pages still render signed out and the client takes over. The root layout's server load also fetches the signed-in visitor's own record (`loadServerUser` in `src/lib/server/server-user.ts`, only the fields the account slot reads) and passes it as `data.auth.user`, so the header renders the avatar and name in the HTML rather than a skeleton; `UserProfileWrapperBloc` shows it until the client query answers. The Login/Register buttons are links to `/auth/login` and `/auth/register` that a script turns into the modal, so the header works without JavaScript.
- `/search` is server-rendered: `src/routes/search/+page.server.ts` runs the same Algolia requests as the bloc through `search.logic.ts`, and the bloc adopts that seed. Keep the two on the shared module; the header and page search boxes are GET forms that must keep working without a script. There is no blank state: a URL that narrows nothing shows the first page of the catalogue.
- Everything the reader chooses on `/search` lives in the URL (`SearchPage.urlState.ts`: query, genre, status, year, sort, view, page, wpage, perPage), so Back and reload resume the page. Handlers write a URL and `syncFromUrl()` derives the state; never assign a request-affecting field directly, or the sync will see nothing to do. Only the sort and view are also applied on the spot.
- Every control on `/search` works without a script: the genre chips are links (`genreHref`, via `ChipGroup`'s `href` on a selecting row, which prevents the click once hydrated), the status/year/sort pickers sit in a GET form with native `<select>`s and an Apply button inside `<noscript>`, and both forms carry the other URL fields as hidden inputs (`carried()` in the view). Keep new controls on that pattern.
- The results grid on `/search` fixes its column count per breakpoint (3/4/6/8/12) and the page sizes (24/48/72/96) divide by all of them, so every page is full rows. The shared `PosterGrid` auto-fills elsewhere.
- The Airing/Upcoming filters are date-based (`buildFilters`: `date_rank` against the hour-floored clock), because MyAnimeList's status label goes stale; Finished is the one label the catalogue is reliable about. If the index ever gains a numeric end date, make Finished date-based too.
- Cloudflare Image Resizing is off in production (`cdn_image_resize: false` in `src/config/static/production/index.json`): the free tier is 5,000 unique transformations a month, the catalogue burned through it in days, and every resized URL then answered `ERROR 9422` (429/503, surfacing as `ERR_BLOCKED_BY_ORB`). Images are served as stored, with no `srcset`; sizing is the image pipeline's job (upscaler-service writes display-sized objects). The resizer code stays for a paid plan; `CDN_IMAGE_RESIZE=off` on a deployment forces it off regardless of config. SafeImage also advances at most once per candidate and clears `srcset` before `src`, because a stale `srcset` during the swap made browsers error twice and skip the raw object. It also ignores an `error` event while the element has a load in flight (`complete` false) and, in the pre-hydration check, a `currentSrc` the current candidate never named: the browser dispatches a failed request's error as a later task, by which time `src` has moved on, and counting it against the next candidate skipped the root object and ended on the not-found image. Tests that fire `error` on a SafeImage element must model `complete` (see `fails()` in `SafeImage.test.ts`).
- Images carry a `srcset` where the element's layout width is known (`widths` + `sizes` on `SafeImage`; PosterCard and the hero rail pass theirs), so each screen fetches its own density; `cdnWidth` stays the plain `src`. The request's image policy (`$lib/stores/image-policy`, provided by the root layout from `locals.saveData`) lowers quality and caps widths only for a visitor who sent `Save-Data: on`; such a response bypasses both page caches (`private, no-store`) because neither keys on the header. Anything that preloads an image (`heroPreloads`) must take the same policy or the hint warms the wrong bytes.
- Shelves (home, works browse) carry 20 cards in the HTML and `PosterGrid shelf` caps them per breakpoint in CSS. Do not slice shelf data by `isPhone`/`isTablet`: the server has no viewport, and slicing meant phones lost 14 cards at hydration.
- PostHog session replay is reserved for signed-in users and the sign-up/sign-in funnel (the auth modal and `/auth/*`): `initPostHogWhenConfigured` sets `disable_session_recording` and `src/lib/client/session-replay.ts` starts and stops the recorder from the client state (`gateSessionReplay`, wired in the root layout's `onMount`). Anonymous browsing is never recorded; enabling it is a change to `wantsReplay`, not to the PostHog project setting.
- GraphQL queries go out as `GET /graphql?extensions={persistedQuery…}` by sha256 hash (`src/lib/services/api/graphql/persisted-fetch.ts`, wrapping the `fetch` of both the SSR client and `AuthenticatedClient`), so Cloudflare can cache the anonymous ones: the gateway proxy marks those responses `public, s-maxage`, everything signed-in `private, no-store`, and a zone cache rule bypasses on the `access_token` cookie. Mutations stay POST. An unknown hash is registered once with a POST; a router without the feature is detected on the first answer and the process falls back to POST. Browser side it is opt-in per config (`graphql_persisted_queries: true` in production and staging); server side `GRAPHQL_PERSISTED_QUERIES=off` turns it off. Never put a viewer-specific field behind a query that must be shareable; the cache key is the operation and variables, and the proxy only ever shares anonymous answers.
- Content that depends on a client-only signal (a PostHog flag, the auth store before it resolves, a 30s clock) must have a server-side default that shows the content; the signal may hide or refine it afterwards, never reveal it.

