<script lang="ts">
  import { AnimeNotificationProviderBloc } from './AnimeNotificationProvider.bloc.svelte';

  /** Renders nothing; it exists to start episode notifications on the client. */
  let {
    bloc = new AnimeNotificationProviderBloc(),
    /** How the start is deferred; injectable so a test can run it synchronously. */
    whenIdle = defaultWhenIdle,
  }: { bloc?: AnimeNotificationProviderBloc; whenIdle?: (run: () => void) => () => void } = $props();

  /**
   * After the page has settled, not at hydration. Starting the worker fired a
   * currently-airing request on every page load, in the same window the hero
   * image and the first posters were still downloading. Nothing on screen
   * depends on it, so it waits for an idle moment (bounded, so a busy tab
   * still gets its notifications).
   */
  function defaultWhenIdle(run: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: { timeout: number }) => number);
    if (ric) {
      const id = ric(run, { timeout: 5000 });
      return () => (window as any).cancelIdleCallback?.(id);
    }
    const id = setTimeout(run, 2000);
    return () => clearTimeout(id);
  }

  // $effect runs on the client only, which is what the old onMount was for.
  $effect(() => whenIdle(() => bloc.start()));
</script>
