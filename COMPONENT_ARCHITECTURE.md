# Component Architecture

How components in this app are structured, and the rules any new or refactored
component follows. Design tokens and visual language live in `DESIGN_SYSTEM.md`;
this document is about code shape.

## The BLoC split

Business logic lives in a **bloc** — a plain class in a `.svelte.ts` module.
The `.svelte` file is a **view**: it renders what the bloc exposes and forwards
intents back to it. Views hold no business rules, no fetching, and no store
singletons.

```
TitleLanguageToggle.svelte            <- view: renders bloc state, calls bloc intents
TitleLanguageToggle.bloc.svelte.ts    <- bloc: state, derived labels, intents
__stories__/TitleLanguageToggle.stories.ts  <- drives the view with a stubbed bloc
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

Never hardcode `oklch()` values — reference the `--weeb-*` tokens.

## Stories

Every component gets a story in `src/svelte/components/__stories__/`, named
`<Component>.stories.ts`. Stories drive the view directly:

- Presentational components: pass props.
- Bloc-backed components: pass `bloc: new FooBloc(<stub ports>)`.

Cover the states that actually differ — empty, loading, error, populated,
overflowing — not just the happy path. Each story gets a one-line doc comment
explaining what it is showing.

## Gates

Both must pass before a change lands:

```bash
yarn check           # svelte-check: must stay at 0 errors
yarn build-storybook # must build clean
```

Storybook requires the Node version in `.nvmrc` (v24.19.0); it refuses to run on
Node 18.
