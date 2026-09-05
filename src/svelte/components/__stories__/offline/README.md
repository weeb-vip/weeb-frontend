# Offline header chrome

`src/lib/Header.svelte` renders four children with no injection seam of their
own: `AuthInitializer`, `LoginModalHandler`, `UserProfileHandler` and
`AutocompleteAdvanced`. Between them they run a GraphQL user query, fetch
`/config.json` and stand up an Algolia client — so opening `Design System/Header`
in a running Storybook went to the network before it drew anything.

Header takes a bloc, but not its children, and Header itself is out of scope for
the story to change. So the substitution happens one level down, in
`.storybook/main.ts`: a Vite plugin that swaps these four imports **only when the
importer is `Header.svelte`**. Every other consumer, including
`Design System/AutocompleteAdvanced`'s own story, resolves the real module.

Each stub renders the same surface the real one does, driven by the ports its
bloc already exposes, so the story still shows the bar as it is laid out — this
narrows the story's *data*, not its *coverage*.

These are not stories; the `*.stories.*` glob does not pick them up.
