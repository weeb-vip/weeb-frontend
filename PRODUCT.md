# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primarily **seasonal watchers**: people following roughly 3–10 currently-airing
shows who open the site to see what has aired, mark episodes watched, and check
what is on next. They arrive mid-season, often mid-week, and the visit is short
and repeated.

Two confirmed secondary audiences share the same product:

- **Catalogue keepers** maintaining a long lifetime list (Currently Watching,
  Plan to Watch, Completed, On Hold, Dropped) as a personal database.
- **Discovery-first browsers** arriving via season browsing, search, or tags to
  find something new, with tracking as the reason they return.

Signed-out visitors can browse, search, and read show pages; tracking and
notifications require an account.

## Product Purpose

weeb.vip lets anime fans track what they are watching and stay current with new
episodes. Success is a returning seasonal watcher who never misses an episode
and never has to hunt for when the next one airs.

## Positioning

Three commitments, confirmed as the differentiators future work must protect:

1. **Accurate broadcast timing.** Real per-episode broadcast schedules, airing
   countdowns, and notifications when episodes actually drop. Timeliness is the
   product, not a side feature.
2. **Speed and low friction.** SSR-first, minimal JavaScript, no social feed or
   clutter. It does the tracking job and gets out of the way.
3. **Focused scope.** Deliberately not a social network, forum, or review site.
   Watchlist + schedule + discovery, nothing else.

Neighbouring products (MyAnimeList, AniList, Kitsu) compete on catalogue breadth
and community; weeb.vip does not, and design work must not drift toward forums,
activity feeds, or review/social surfaces.

## Operating Context

- Repeated short sessions during a season, frequently on mobile.
- The recurring loop: check what aired → mark episodes watched → check what is
  next → occasionally add a show found through season browsing or search.
- Broadcast times are timezone-sensitive; the app handles timezone conversion
  (`@date-fns/tz`, `@date-fns/utc`) for schedule and countdown display.
- Notifications depend on upstream broadcast-schedule accuracy, so schedule
  correctness is an operational concern, not only a UI one.

## Capabilities and Constraints

Confirmed capabilities (from the shipped routes and content model):

- Watchlist tracking across five statuses: Currently Watching, Plan to Watch,
  Completed, On Hold, Dropped, with per-episode progress.
- Episode notifications driven by broadcast schedules.
- Currently-airing list and weekly calendar (`/airing`, `/airing/calendar`).
- Season browsing (`/season/[season]`) and tag-based browsing.
- Algolia-backed search (`/search`).
- Anime detail pages with description, episodes, studios, air dates, tags,
  ratings, and per-show news (`/anime/[slug]`, `/show/[id]`).
- Accounts: registration, email verification, login, password reset, profile,
  and settings.
- Generated XML sitemaps and OG images for share/SEO surfaces.

Technical constraints:

- SvelteKit 2 / Svelte 5 on Vite 6; TailwindCSS 3 plus SCSS.
- Data comes from a GraphQL gateway with generated types (`src/gql/`); search
  from Algolia. No direct database access.
- Deployed to Cloudflare Pages via `@sveltejs/adapter-cloudflare`; an
  `@sveltejs/adapter-node` + Docker path is kept for container hosting.
- One image serves multiple environments; runtime config arrives as a mounted
  `config.json` (see `src/config/`).
- SSR must render real content — client-only rendering has previously shipped
  empty documents to crawlers and is treated as a defect.

Terminology: **shows** (not "titles" or "series" exclusively), **watchlist**,
**airing**, **season**, **tags** (not "genres" — a prior fix explicitly moved
search and browsing from genres to tags).

## Brand Commitments

- Name: **weeb.vip**, rendered in product copy as **WeebVIP**.
- An existing indigo/violet identity pulled from the logo, documented in
  `DESIGN_SYSTEM.md` and implemented as oklch tokens in
  `src/styles/design-tokens.css`.
- The UI is dark-theme only; there is no light mode. (`AboutPage.svelte` still
  claims "Dark and light theme support" — that copy is stale and contradicts the
  design system.)

## Evidence on Hand

- Real production site at https://weeb.vip with real catalogue data from the
  GraphQL gateway.
- `DESIGN_SYSTEM.md` — the incumbent token and component documentation.
- `content-model.md` — entity/field reference extracted from the schema.
- `src/styles/design-tokens.css` — the implemented token source of truth.
- Storybook (`yarn storybook`, port 6006) as a component explorer.

No testimonials, user counts, press, pricing, or benchmark data exist. Do not
invent them. `about` page claims about performance and accessibility are
aspirational product copy, not measured results.

## Product Principles

1. **The schedule is the promise.** Anything that makes airing times, countdowns,
   or episode state less accurate or less legible is a regression, however good
   it looks.
2. **Short visit, complete job.** The recurring loop (what aired → mark watched →
   what's next) must stay reachable in the fewest possible steps.
3. **Fast beats rich.** SSR-first and minimal JavaScript are product decisions;
   weight added to a surface has to earn itself against them.
4. **Stay in scope.** No social feed, forum, or review layer. New surfaces serve
   tracking, schedule, or discovery.
5. **Cover art carries the product.** Show imagery is the primary visual
   material; the interface frames it rather than competing with it.

## Accessibility & Inclusion

No product-specific standard has been established by the user. The codebase
treats SSR-rendered content and keyboard/no-JS browsing as requirements, and
Playwright covers desktop, mobile, iOS, and Android viewports.
