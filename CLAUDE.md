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
- `yarn test:e2e` - End-to-end tests (Playwright); `tests/e2e/` is outside vitest's `include`, so `yarn test` never picks it up
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
- Settings (`/settings`), About (`/about`)
- Auth flows under `/auth/` (login, register, verification, password reset)
- Generated XML sitemaps and OG images (`/sitemap*.xml`, `/og/[id]`)
