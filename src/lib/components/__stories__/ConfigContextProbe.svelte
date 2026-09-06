<script lang="ts">
  import { getContext, untrack } from 'svelte';
  import ProviderPanel from './ProviderPanel.svelte';
  import { networkRow, type PanelRow } from './provider-stubs';
  import type { IConfig } from '../../../config/interfaces';

  /**
   * Story support: a real child of `ConfigProvider` that renders the config it
   * was handed.
   *
   * It has to be a component, not a snippet: `getContext` only answers during a
   * component's own initialisation, and a snippet passed as `children` runs on
   * the STORY's behalf, so it would read the story's context and the panel
   * would be showing something no child of the provider ever sees.
   */
  let {
    fallback = false,
    requests = 0,
  }: {
    /** True when the store was empty, so this is the provider's own default. */
    fallback?: boolean;
    requests?: number;
  } = $props();

  // Read in the init body deliberately -- see above. `untrack` only keeps the
  // compiler from warning about it.
  const config = untrack(() => getContext<IConfig | undefined>('config'));

  const rows = $derived<PanelRow[]>([
    {
      label: 'in context at child init',
      value: config ? 'yes' : 'no — every consumer would throw',
      tone: config ? 'ok' : 'bad',
    },
    { label: 'graphql_host', value: config?.graphql_host ?? '—' },
    { label: 'algolia_index', value: config?.algolia_index ?? '—' },
    { label: 'cdn_url', value: config?.cdn_url ?? '—' },
    { label: 'cdn_user_url', value: config?.cdn_user_url ?? '—' },
    { label: 'environment', value: config?.environment ?? '—' },
    networkRow(requests),
  ]);
</script>

<ProviderPanel
  title="Child of ConfigProvider"
  note={fallback
    ? 'Nothing hydrated the store, so this is the provider’s own minimal fallback. Only cdn_user_url is filled — but it is an object, not null, so a consumer reading a field off it still renders.'
    : 'The config the root layout hydrated, read straight out of Svelte context. No second request for /config.json is made to get it.'}
  {rows}
/>
