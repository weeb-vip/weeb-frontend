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
src/lib/components/<group>/<Component>/
                              one folder per component (see below)
src/lib/components/<group>/   modules two components in the group share
src/lib/components/__stories__/
                              page stories, shared fixtures, the offline stubs
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

Import any component through its folder: `$lib/components/<group>/Foo`, which
resolves via that folder's `index.ts`. Only files *inside* a component's own
folder import each other relatively (`./Foo.bloc.svelte`).

The data layer is three named layers, not three files called `queries`:

- `services/api/graphql/queries.ts` -- the generated gql documents.
- `services/query-options.ts` -- `{ queryKey, queryFn }` factories plus auth and
  token refresh. Framework-agnostic; this is what `load`, workers and SSR call.
- `services/query-hooks.ts` -- `useX()` Svelte Query hooks over those options,
  with cache invalidation and store side effects. This is what components call.

## One folder per component

Every component is a folder named for it, inside its group:

```
src/lib/components/primitives/Button/
  index.ts             the public entry: the component AND its types
  Button.svelte        markup, props, scoped styles, direct wiring
  Button.logic.ts      pure functions, types and constants
  Button.stories.ts
  Button.test.ts       (only where one exists)

src/lib/components/shell/Header/
  index.ts
  Header.svelte
  Header.bloc.svelte.ts
  Header.stories.ts
```

`index.ts` is the only entry anything outside the folder uses. It re-exports the
component as the default plus every type, interface and helper the component's
API is written in, so a call site needs one specifier for both:

```ts
import Chip, { type ChipTone } from '$lib/components/primitives/Chip';
```

A story lives with its component and keeps its `title:` unchanged, so the
Storybook sidebar is still the map the group folders draw. What stays in
`__stories__/` is what serves many components: the `Pages/` stories (their views
are routes, not library components), the shared fixtures
(`show-fixtures.ts`, `profileFixtures.ts`, `auth-stubs.ts`), `StoryContainer`,
the demo wrappers and the `offline/` stubs.

A module that two components in a group share is not one component's logic, so
it sits at the group root beside the folders rather than inside one of them:
`cards/Card.bloc.svelte.ts`, `profile/MediaList.bloc.svelte.ts`,
`show/ShowContent.rules.ts`, `auth/auth-shared.ts`.

### Naming the logic module

| file | what goes in it |
| --- | --- |
| `Foo.bloc.svelte.ts` | a bloc: `$state`, ports, intents |
| `Foo.logic.ts` | pure functions, types and constants -- no runes |

Both are named for the component and distinguished by an infix, and the infix is
not optional: `Foo.svelte.ts` would be imported as `'./Foo.svelte'`, which is the
component. Keep `.svelte.ts` on anything using runes -- they only compile there
-- and use a plain `.ts` for everything else. Both kinds import cleanly in a
test: vitest compiles them through `vite-plugin-svelte`, so a `.svelte.ts` bloc
is imported directly rather than mirrored into the test file.

Only create one where there is something to put in it. A component whose props
interface is its entire type surface keeps that interface in the `.svelte`; a
file that exists to re-export one interface is noise.

### Components hold no logic

A `.svelte` may contain `$props()`, markup, scoped `<style>`, and direct wiring
-- `onclick={() => bloc.toggle()}`, an event adapter, a portal action, a DOM
measurement. Everything that *decides* something moves out:

- `$derived` that formats or chooses
- ternaries picking a label, a class or a size out of a prop
- `.filter` / `.map` / `.sort` over data
- date and number formatting
- conditional class maps

Where the component has a bloc, that is where they go. Where it is presentational,
they go in `Foo.logic.ts` as pure functions -- **not** a bloc class; a component
with no state does not get given some.

The test is whether a reader can see what the component *renders* without reading
how anything is *decided*. Judgement still applies: `class:active={tab.active}`
and `{item.label}` are markup, and a single comparison read straight off a prop
(`const isInert = $derived(isLoading || disabled)`) is not worth a function.

## The BLoC split

Business logic lives in a **bloc** — a plain class in a `.svelte.ts` module.
The `.svelte` file is a **view**: it renders what the bloc exposes and forwards
intents back to it. Views hold no business rules, no fetching, and no store
singletons.

```
components/shell/TitleLanguageToggle/
  index.ts                            <- the public entry
  TitleLanguageToggle.svelte          <- view: renders bloc state, calls bloc intents
  TitleLanguageToggle.bloc.svelte.ts  <- bloc: state, derived labels, intents
  TitleLanguageToggle.stories.ts      <- drives the view with a stubbed bloc
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
for `Button` or `Tag` would be ceremony around nothing; what they get instead,
where they decide anything at all, is a `Foo.logic.ts` of pure functions.

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
`Register.bloc.svelte.ts` sit at the root of `components/auth/` because
`LoginRegisterModal` composes them, and `ShowContent.rules.ts` at the root of
`components/show/` because `ShowInformation` and `ShowSectionNav` read it.
Neither has a view in the library, so neither gets a folder.
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

Every component gets a story in its own folder, named `<Component>.stories.ts`,
and imports the view relatively (`./Foo.svelte`). Page stories stay in
`src/lib/components/__stories__/`, next to the fixtures they share. Stories drive
the view directly:

- Presentational components: pass props.
- Bloc-backed components: pass `bloc: new FooBloc(<stub ports>)`.
- Pages: import the route's `+page.svelte` and pass `bloc` plus a `data`
  fixture. These live in `__stories__/` under the `Pages/` title. `Seo` renders in every one of
  them, so `.storybook/preview.ts` supplies a default `$page` store; a story
  whose canonical URL is worth reading overrides
  `parameters.sveltekit_experimental.stores.page`.

Cover the states that actually differ — empty, loading, error, populated,
overflowing — not just the happy path. Each story gets a one-line doc comment
explaining what it is showing.

## Tests

**Vitest**, configured in the `test` block of `vite.config.ts` so tests run
through the app's own Vite pipeline. That is the whole reason for the runner
choice: `vite-plugin-svelte` compiles both `.svelte` components and `.svelte.ts`
runes modules, so a bloc is imported into its test like any other module. The
previous runner (ts-jest, `testEnvironment: node`) could load neither, and the
one bloc test in the tree had to keep a hand-copied duplicate of the function it
was checking.

A test lives beside what it tests, named for it -- `Button.test.ts`,
`UserProfileWrapper.test.ts` -- and there are two kinds:

- **Logic tests** call exported functions and blocs directly. Most tests are
  these. A bloc is constructed with stub ports, exactly as a story constructs
  one, and its getters are read.
- **Component tests** mount the view with `@testing-library/svelte` and query it
  by accessible role and name, never by class or test id. Children arrive as a
  Svelte 5 snippet, so build one with `createRawSnippet`. See
  `primitives/Button/Button.test.ts`.

Prefer a logic test. Mount the component only for what the DOM decides: what is
rendered at all, what is focusable, what a click actually calls.

The environment is `jsdom`. A file that needs the SSR path -- code branching on
`typeof window === 'undefined'` -- opts out with a `@vitest-environment node`
docblock; `actions/__tests__/anchoredPosition.test.ts` is the example.

### What unit tests are for, and what they are not for

**Unit tests cover components; e2e covers pages.** `src/lib/components/**` is
what a unit test is for -- a component is a unit with props in and DOM out, and
mounting one in jsdom says something true about it. A `+page.svelte` is a
composition of those components plus a loader, and what is worth asserting
about it -- that the route resolves, the data arrives, the flow completes -- is
exactly what `tests/e2e` already drives in a real browser. Mounting a page in
jsdom to reach a number would duplicate that with a weaker instrument.

So the coverage gate is scoped rather than global.

Coverage is `@vitest/coverage-v8` (`yarn test:coverage`). Story support and
test helpers are excluded from the denominator -- `**/__stories__/**`,
`**/*.stories.*`, `**/__tests__/**`, `**/__fixtures__/**` -- because none of it
ships; leaving it in was quietly costing several points of a number that is
supposed to describe the app.

`vite.config.ts` thresholds **`src/lib/components/**` at 80% statements** (with
branches 70 / functions 75 / lines 80: in a Svelte view every `{#if}`, `??` and
event handler is a branch or a function of its own, so those sit structurally
below statements for the same amount of behaviour exercised). `src/routes/**`
is deliberately unthresholded -- see above.

The 80% is the standard the suites are being written to, not a description of
where they are. When `yarn test:coverage` fails on it, the answer is another
component suite, never a lower number in the config.

## Gates

All of these must pass before a change lands:

```bash
yarn check            # svelte-check: must stay at 0 errors
yarn test             # vitest (unit + component); yarn test:watch while working
yarn build-storybook  # must build clean
yarn storybook:smoke  # against a running Storybook: must report 0 failing
```

`build-storybook` only **compiles** stories — it never mounts one, so a clean
build is not evidence that anything renders. `storybook:smoke`
(`scripts/smoke-stories.mjs`) drives a real browser over every story and is the
gate that actually catches a broken render. Run it against `yarn storybook`.

Storybook requires the Node version in `.nvmrc` (v24.19.0); it refuses to run on
Node 18.
