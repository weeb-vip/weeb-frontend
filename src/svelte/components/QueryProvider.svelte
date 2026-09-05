<script lang="ts">
  import type { Snippet } from 'svelte';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { initializeQueryClient } from '../services/query-client';

  /**
   * The one place a TanStack QueryClient is put into Svelte context.
   *
   * Seven components used to repeat this: an `onMount` that dynamically
   * `import()`ed `@tanstack/svelte-query`, an `isClient` flag, a lazily built
   * client, a `<svelte:component this={QueryClientProvider}>` and a bespoke
   * "Loading..." branch for the window in which none of that had resolved.
   * The dynamic import was the load-bearing part of that dance and it was never
   * needed -- the root layout has always imported `QueryClientProvider`
   * statically and wrapped the whole app in it, and so did `CheckEmailPage`.
   * With a static import there is no async gap, so there is no client flag, no
   * dynamic component, and no loading branch to keep in sync across seven
   * copies. The child mounts in the same tick, during SSR as well as hydration.
   *
   * `initializeQueryClient()` is what keeps this SSR-safe: a fresh client per
   * server render, so no per-user cache leaks between concurrent requests, and
   * the shared singleton in the browser.
   */
  let { children }: { children: Snippet } = $props();

  const queryClient = initializeQueryClient();
</script>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
