<script lang="ts">
  import { untrack } from 'svelte';
  import { AuthInitializerBloc, type SsrAuth } from './AuthInitializer.bloc.svelte';

  /**
   * Renders nothing: it brings the client session up on mount. Mounted once,
   * by the header.
   */
  let {
    ssrAuth = undefined,
    bloc = new AuthInitializerBloc(),
  }: {
    /** Server-resolved auth, so the common case costs no GraphQL round trip. */
    ssrAuth?: SsrAuth;
    bloc?: AuthInitializerBloc;
  } = $props();

  // Client-only, like the onMount it replaces, and the teardown now actually
  // releases the subscriptions this used to leak on every mount. `ssrAuth` is
  // read untracked deliberately: the header lives in the layout, so the prop
  // gets a new identity on every navigation, and tracking it would re-run the
  // whole bootstrap each time.
  $effect(() => bloc.start(untrack(() => ssrAuth)));
</script>
