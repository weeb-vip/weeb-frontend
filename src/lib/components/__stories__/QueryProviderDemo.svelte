<script lang="ts">
  import QueryProvider from '$lib/components/shell/QueryProvider';
  import QueryClientContextProbe from './QueryClientContextProbe.svelte';
  import { getQueryClient } from '$lib/services/query-client';
  import { installOfflineFetch } from './provider-stubs';

  /**
   * `QueryProvider` with a probe child inside it. The provider renders no
   * markup, so the child is the whole story: it reaches for a QueryClient at
   * init and reports what it got and when.
   */
  let requests = $state(0);
  const restoreFetch = installOfflineFetch(() => (requests += 1));

  /*
    Build the singleton before the provider asks for it. `initializeQueryClient()`
    warms the GraphQL socket when IT is the call that constructs the client, and
    a story opens no sockets -- `getQueryClient()` is the same client without
    that. (The offline fetch above would refuse the warm-up anyway; this is so
    the panel can honestly report zero attempts rather than one refusal.)
  */
  getQueryClient();

  let childInitialised = $state(false);
  let mountedWithProvider = $state<boolean | null>(null);

  $effect(() => {
    /*
      Mount effects run once the whole tree has initialised. The child having
      already reported by now is exactly what "no loading branch" means: with
      the onMount + dynamic `import()` this provider replaced, the probe would
      still be behind a "Loading..." fallback at this point and would not report
      until a later tick.
    */
    mountedWithProvider = childInitialised;
    return restoreFetch;
  });
</script>

<div class="frame">
  <QueryProvider>
    <QueryClientContextProbe
      onInit={() => (childInitialised = true)}
      {mountedWithProvider}
      {requests}
    />
  </QueryProvider>
</div>

<style>
  .frame {
    padding: 24px;
  }
</style>
