# Component Architecture

How components in this app are structured, and the rules any new or refactored
component follows. Design tokens and visual language live in `DESIGN_SYSTEM.md`;
this document is about code shape.

## Where things live

Everything shared lives under `src/lib/`, reached through SvelteKit's built-in
`$lib` alias. There are no other path aliases.

`src/lib/components/` is a **reusable-only component library**: nothing goes in
it that has a single caller. Page code -- a page's bloc and its pure-logic
modules -- lives beside the `+page.svelte` that uses it, in `src/routes/`.

```
src/lib/components/<group>/   views + their blocs, grouped by kind
src/lib/components/__stories__/   every story, its fixtures, and the offline stubs
src/lib/components/__tests__/     unit tests for component-adjacent logic
src/lib/stores/               store singletons
src/lib/actions/              Svelte actions
src/lib/composables/          shared rune helpers
src/lib/utils/                framework-free helpers
src/lib/data/                 static data the app renders (the genre taxonomy)
src/lib/services/             the data layer (see below)
src/lib/server/               server-only modules
src/lib/client/               browser-only modules

src/routes/<route>/           the +page.svelte, its bloc, its pure-logic
                              modules and their unit tests
src/routes/works/             a shared page body with no +page file, so no URL
```

The component groups mirror the Storybook sidebar one-for-one, so the tree and
the sidebar are the same map: `primitives/` is `Primitives/`, and `cards/`,
`show/`, `tracking/`, `profile/`, `home/`, `auth/`, `shell/` are the
`Composites/<Area>/` tiers (`shell/` is `App Shell`). There is no `pages/`
group: the `Pages/` tier of the sidebar is driven by stories that import the
routes themselves.

Import across groups with `$lib/components/<group>/Foo.svelte`; import within a
group relatively (`./Foo.svelte`). A bloc always sits beside its view.

The data layer is three named layers, not three files called `queries`:

- `services/api/graphql/queries.ts` -- the generated gql documents.
- `services/query-options.ts` -- `{ queryKey, queryFn }` factories plus auth and
  token refresh. Framework-agnostic; this is what `load`, workers and SSR call.
- `services/query-hooks.ts` -- `useX()` Svelte Query hooks over those options,
  with cache invalidation and store side effects. This is what components call.

## The BLoC split

Business logic lives in a **bloc** — a plain class in a `.svelte.ts` module.
The `.svelte` file is a **view**: it renders what the bloc exposes and forwards
intents back to it. Views hold no business rules, no fetching, and no store
singletons.

```
components/shell/TitleLanguageToggle.svelte          <- view: renders bloc state, calls bloc intents
components/shell/TitleLanguageToggle.bloc.svelte.ts  <- bloc: state, derived labels, intents
components/__stories__/TitleLanguageToggle.stories.ts <- drives the view with a stubbed bloc
```

A bloc exposes three things and nothing else:

- **State** — `$state` fields, or values bridged from a store (see below).
- **Derived reads** — getters. Anything the view would otherwise compute inline.
- **Intents** — methods named for what the user meant (`toggle()`, `retry()`,
  `selectStatus(s)`), not for the mechanism (`setOpenTrue`).

### Dependency injection is the point

A bloc takes its dependencies through the constructor, with the real one as the
default. That default keeps call sites unchanged; the seam is what lets a story
or a unit test run the logic without localStorage, network, or a query client.

Narrow each dependency to a **port** — the smallest interface the bloc actually
uses — rather than importing the concrete singleton's type:

```ts
export interface PreferencesPort extends Readable<{ titleLanguage: TitleLanguage }> {
  toggleTitleLanguage: () => void;
}

export class TitleLanguageToggleBloc {
  readonly #prefs: PreferencesPort;
  readonly #state: { current: { titleLanguage: TitleLanguage } };

  constructor(prefs: PreferencesPort = preferencesStore) {
    this.#prefs = prefs;
    this.#state = fromStore(prefs);
  }

  get isEnglish(): boolean { return this.#state.current.titleLanguage === 'english'; }
  get shortLabel(): string { return this.isEnglish ? 'EN' : 'JP'; }

  toggle(): void { this.#prefs.toggleTitleLanguage(); }
}
```

### Reading a Svelte store from a bloc

Use `fromStore` from `svelte/store`. It is lazy — it subscribes only when the
value is read inside a tracking context (i.e. while the view renders it) and
unsubscribes with that effect. Constructing a bloc at module scope, which is
what a story's `args` does, therefore leaks nothing.

Do not subscribe manually in a constructor; that has no cleanup.

### Wiring the view

```svelte
<script lang="ts">
  import { TitleLanguageToggleBloc } from './TitleLanguageToggle.bloc.svelte';

  let { bloc = new TitleLanguageToggleBloc() }: { bloc?: TitleLanguageToggleBloc } = $props();
</script>

<button onclick={() => bloc.toggle()} aria-label={bloc.actionLabel}>
  {bloc.shortLabel}
</button>
```

Note the import specifier: a `Foo.bloc.svelte.ts` module is imported as
`'./Foo.bloc.svelte'`, without the `.ts`.

## When a component does NOT get a bloc

Purely presentational components — the ones that take data in and render it,
holding no state beyond transient UI detail — stay plain prop components. A bloc
for `Button` or `Tag` would be ceremony around nothing.

Give a component a bloc when it does any of:

- fetches (TanStack Query, `fetch`, an API service)
- reads or writes a store singleton
- owns state that outlives a single render (open/closed, selection, pagination)
- runs side effects (timers, observers, `window`/`document`, navigation)

## Pages are routes, not components

`src/lib/components/` is for things with more than one caller. A page body
has exactly one, so it lives in its route: the `+page.svelte` **is** the page,
markup, scoped styles and all. There is no `SearchPage.svelte` for
`/search/+page.svelte` to delegate to.

The bloc moves with it. `SearchPage.bloc.svelte.ts` and its friends sit in
`src/routes/search/`, next to the `+page.svelte` that is their view -- they are
the testable half, imported by the route, by its tests and by the story, and
the split is the same one as anywhere else: the route file is the view. A
module with one page as its only caller is not library code, so it does not
live in `src/lib/components/`.

The exception is a page module a *library* component depends on. That
dependency is what makes it shared, so it moves into the library group of the
component that needs it, never the other way around: `Login.bloc.svelte.ts` and
`Register.bloc.svelte.ts` are in `components/auth/` because
`LoginRegisterModal` composes them, and `ShowContent.rules.ts` is in
`components/show/` because `ShowInformation` and `ShowSectionNav` read it.
Nothing under `src/lib/` may import from `src/routes/`.

Three things follow from a route being the view:

- **Props are the loader's.** The route keeps `let { data } = $props()` and
  reads the payload off it; the bloc's `source` accessor closes over `data`, so
  the server frame still renders complete. Stories inject `bloc` alongside a
  `data` fixture.
- **A `{#key}` on a route param has to become explicit.** SvelteKit reuses one
  `+page.svelte` across a param change, so what used to be
  `{#key data.season}<SeasonPage … />` is now a `$derived` bloc keyed on the
  param, with the markup keyed on the same value. `/season/[season]` and
  `/anime/[slug]` both do this.
- **A body shared by two routes is still page code.** `WorksBrowse.svelte`
  renders both `/manga` and `/light-novels`, so it cannot live in either route
  folder -- but two pages is not a library either. It sits in
  `src/routes/works/`, a folder with no `+page` file and therefore no URL
  (`/works` 404s). Each route keeps its own `Seo`, copy and loader and imports
  the body from `../works/WorksBrowse.svelte`.

## Runes, not legacy syntax

New and refactored components use Svelte 5 runes:

- `$props()` instead of `export let`
- `$state` / `$derived` instead of `$:`
- `onclick={...}` callback props instead of `on:click` and `createEventDispatcher`

A component being converted to runes must have its call sites checked: a runes
component does not accept `on:event` directives from a parent.

## Reuse before invention

Before writing markup, check whether a primitive already covers it. Reach for
the existing shared components rather than re-rolling a surface, a pill, a
skeleton, or a field. If you find yourself copying markup from another
component, that is the signal to extract a primitive instead.

Reusing the *tokens* is not the same as reusing the component. Four files each
declaring the pill shape off `--weeb-pill-*` is still four copies of the pill;
`Chip` is the pill, and it is the only file that reads those tokens. The same
goes for `Score`, `StatusMarker` and `AiringIndicator`: a score, a list-status
ribbon and an "on the air" mark are drawn in one place each.

Never hardcode `oklch()` values — reference the `--weeb-*` tokens.

## Two presentations, one behaviour

A dialog is not a component, it is a set of behaviours: portal out of whatever
clipped ancestor it was declared in, hold focus, close on Escape, pin the page.
`Modal` and `MobileDrawer` look nothing alike and both need all four, so the
four live in one action -- `actions/dialog.ts` -- and each component supplies
only its markup. They used to be two independent implementations, which is two
focus traps to keep correct forever.

Where a behaviour needs to differ, it is a parameter rather than a fork: the
drawer focuses its close button (`initialFocus`) instead of the first focusable,
and takes its page pin as a port so a story can pass a no-op. The pin itself is
ref-counted at module scope, because the two surfaces overlap -- opening the
login modal from the drawer leaves both mounted while the drawer's outro runs.

The same rule applies to what a dialog CONTAINS: `LoginRegisterModal` is
content-only and `Modal` wraps it. A component that renders its own backdrop is
a second dialog.

## Stories

Every component gets a story in `src/lib/components/__stories__/`, named
`<Component>.stories.ts`. Stories drive the view directly:

- Presentational components: pass props.
- Bloc-backed components: pass `bloc: new FooBloc(<stub ports>)`.
- Pages: import the route's `+page.svelte` and pass `bloc` plus a `data`
  fixture. These live under the `Pages/` title. `Seo` renders in every one of
  them, so `.storybook/preview.ts` supplies a default `$page` store; a story
  whose canonical URL is worth reading overrides
  `parameters.sveltekit_experimental.stores.page`.

Cover the states that actually differ — empty, loading, error, populated,
overflowing — not just the happy path. Each story gets a one-line doc comment
explaining what it is showing.

## Gates

All of these must pass before a change lands:

```bash
yarn check            # svelte-check: must stay at 0 errors
yarn test             # jest
yarn build-storybook  # must build clean
yarn storybook:smoke  # against a running Storybook: must report 0 failing
```

`build-storybook` only **compiles** stories — it never mounts one, so a clean
build is not evidence that anything renders. `storybook:smoke`
(`scripts/smoke-stories.mjs`) drives a real browser over every story and is the
gate that actually catches a broken render. Run it against `yarn storybook`.

Storybook requires the Node version in `.nvmrc` (v24.19.0); it refuses to run on
Node 18.
