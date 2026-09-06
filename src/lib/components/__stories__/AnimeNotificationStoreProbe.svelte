<script lang="ts">
  import type { Readable } from 'svelte/store';
  import ProviderPanel from './ProviderPanel.svelte';
  import { networkRow, type PanelRow, type NotificationStoreShape } from './provider-stubs';

  /**
   * Story support: the probe for `AnimeNotificationProvider`.
   *
   * That provider puts nothing in context -- it starts the notification manager,
   * which fills a store. So the probe is an observer of that store rather than
   * a child of the provider, and what it shows is the state a countdown or an
   * episode toast renders from once the manager is up.
   */
  let {
    store,
    initializeCalls,
    claimed,
    requests = 0,
  }: {
    store: Readable<NotificationStoreShape>;
    /** How many times the manager was asked to start. One is the contract. */
    initializeCalls: number;
    /** Whether this browser session had already claimed the work. */
    claimed: boolean;
    requests?: number;
  } = $props();

  const timed = $derived(Object.keys($store.timingData));

  const rows = $derived<PanelRow[]>([
    {
      label: 'notifications.initialize() calls',
      value: `${initializeCalls}${initializeCalls === 1 ? ' — exactly once' : ''}`,
      tone: initializeCalls === 1 ? 'ok' : claimed && initializeCalls === 0 ? 'warn' : 'bad',
    },
    {
      label: 'store.isReady',
      value: $store.isReady ? 'true — the manager is up' : 'false — nothing started',
      tone: $store.isReady ? 'ok' : 'warn',
    },
    { label: 'store.timingData', value: timed.length ? timed.join(', ') : 'empty' },
    {
      label: 'store.countdowns',
      value:
        Object.entries($store.countdowns)
          .map(([id, c]) => `${id}: ${c.countdown}`)
          .join(' · ') || 'empty',
    },
    networkRow(requests),
  ]);
</script>

<ProviderPanel
  title="The notification store, after the provider mounted"
  note={claimed
    ? 'This browser session had already claimed the work, so the provider started nothing and the store is untouched — which is the whole point of the guard.'
    : 'The provider started the manager once and the store filled. The manager itself is stubbed: the real one opens a worker, runs a GraphQL query and writes to localStorage.'}
  {rows}
/>
