<script lang="ts">
  import { untrack } from 'svelte';
  import { useQueryClient } from '@tanstack/svelte-query';
  import { getQueryClient } from '$lib/services/query-client';
  import ProviderPanel from './ProviderPanel.svelte';
  import { networkRow, type PanelRow } from './provider-stubs';

  /**
   * Story support: a real child of `QueryProvider` that does what every real
   * child does -- reach for the QueryClient during its own initialisation.
   *
   * `useQueryClient` throws when there is none, so this component existing on
   * screen is itself the assertion. It must be a component rather than a
   * snippet for the same reason `ContextProbe` is: a snippet handed over as
   * `children` reads the story's context, not the provider's.
   */
  let {
    onInit,
    mountedWithProvider = null,
    requests = 0,
  }: {
    /** Called at the one moment the client is reachable, so the demo can time it. */
    onInit: () => void;
    /** Whether this child was already initialised when mount effects ran. */
    mountedWithProvider?: boolean | null;
    requests?: number;
  } = $props();

  const client = untrack(() => {
    onInit();
    return useQueryClient();
  });

  const defaults = client.getDefaultOptions().queries ?? {};

  const rows = $derived<PanelRow[]>([
    {
      label: 'useQueryClient() at child init',
      value: `returned a ${client.constructor.name}`,
      tone: 'ok',
    },
    {
      label: 'mounted in the provider’s own tick',
      value:
        mountedWithProvider === null
          ? '…'
          : mountedWithProvider
            ? 'yes — no “Loading…” branch to wait on'
            : 'no — the child arrived a tick late',
      tone: mountedWithProvider === false ? 'bad' : mountedWithProvider ? 'ok' : 'plain',
    },
    {
      label: 'shared browser client',
      value: client === getQueryClient() ? 'yes — one cache for the whole tab' : 'no',
      tone: client === getQueryClient() ? 'ok' : 'warn',
    },
    { label: 'defaults · retry', value: String(defaults.retry) },
    { label: 'defaults · staleTime', value: `${defaults.staleTime}ms` },
    { label: 'defaults · refetchOnWindowFocus', value: String(defaults.refetchOnWindowFocus) },
    { label: 'cached queries', value: String(client.getQueryCache().getAll().length) },
    networkRow(requests),
  ]);
</script>

<ProviderPanel
  title="Child of QueryProvider"
  note="A QueryClient is in context by the time this child initialises, which is when createQuery needs one — and the child is here in the same tick as the provider, not behind the dynamic import and “Loading…” branch this replaced."
  {rows}
/>
