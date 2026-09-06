import { flushSync } from 'svelte';

/**
 * Test support: keeps a bloc's store-backed reads live.
 *
 * A bloc bridges its TanStack stores with `fromStore`, which is lazy by design
 * (see COMPONENT_ARCHITECTURE, "Reading a Svelte store from a bloc"): outside a
 * tracking context it falls back to a one-shot `get(store)`, and
 * `createQuery`/`createMutation` build their store as
 * `readable(observer.getCurrentResult(), start)` -- a store that only receives
 * new values while something is subscribed to it. In the app the view's render
 * is that subscriber, so `isPending`, `isLoading` and the query data all move.
 * In a bare unit test nothing renders, so those reads would sit frozen at the
 * value they had when the bloc was constructed.
 *
 * This opens one effect root, reads the bloc inside an effect so the
 * subscription is established and stays established, and hands back the
 * teardown. Anything that needs to observe a query or mutation moving -- a
 * pending write, a page of rows arriving -- wraps itself in one of these.
 *
 * Lives in `__tests__/` rather than beside a component because every bloc test
 * that touches a query needs it; the coverage config already excludes the
 * folder.
 */
export function reactiveScope(...reads: (() => unknown)[]): () => void {
  const stop = $effect.root(() => {
    $effect(() => {
      for (const read of reads) read();
    });
  });

  flushSync();
  return stop;
}
