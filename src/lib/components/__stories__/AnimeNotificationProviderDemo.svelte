<script lang="ts">
  import { untrack } from 'svelte';
  import { writable } from 'svelte/store';
  import AnimeNotificationProvider from '$lib/components/shell/AnimeNotificationProvider';
  import {
    AnimeNotificationProviderBloc,
    type OnceGuardPort,
  } from '$lib/components/shell/AnimeNotificationProvider';
  import AnimeNotificationStoreProbe from './AnimeNotificationStoreProbe.svelte';
  import {
    installOfflineFetch,
    NOTIFICATIONS_EMPTY,
    NOTIFICATIONS_READY,
    type NotificationStoreShape,
  } from './provider-stubs';

  /**
   * `AnimeNotificationProvider` renders nothing: it starts the episode
   * notification manager, once per browser session. This shows both halves --
   * the store the manager fills, and that remounting the component does not
   * fill it a second time.
   *
   * Both of its ports are stubbed. The real manager opens a web worker, runs a
   * GraphQL query for what is airing and writes sent-notification records to
   * localStorage; the real guard is a flag on `window`, which would follow the
   * reader into every other story.
   */
  let {
    /** Start from a session that already claimed the work: the provider does nothing. */
    alreadyClaimed = false,
  }: { alreadyClaimed?: boolean } = $props();

  const claimed = untrack(() => alreadyClaimed);

  let requests = $state(0);
  const restoreFetch = installOfflineFetch(() => (requests += 1));

  const store = writable<NotificationStoreShape>(NOTIFICATIONS_EMPTY);
  let initializeCalls = $state(0);

  const notifications = {
    initialize: async () => {
      // Called from inside the provider's own `$effect`. Reading the counter
      // there would make that effect depend on it and re-run on the write, so
      // the bookkeeping is untracked -- the panel is a separate reader and
      // still sees it.
      untrack(() => {
        initializeCalls += 1;
      });
      store.set(NOTIFICATIONS_READY);
    },
  };

  /** The real guard, minus the window flag: first caller through, nobody after. */
  function localOnce(startsClaimed: boolean): OnceGuardPort {
    let taken = startsClaimed;
    return {
      claim: () => {
        if (taken) return false;
        taken = true;
        return true;
      },
    };
  }

  // One guard for the whole session, and a fresh bloc per mount -- which is
  // exactly how the app has it: the component remounts on every layout
  // re-render and builds a new default bloc, while the guard lives on.
  const once = localOnce(claimed);

  let mounts = $state(0);

  $effect(() => restoreFetch);
</script>

<div class="frame">
  {#key mounts}
    <!-- Renders nothing. The panel below is the story. -->
    <AnimeNotificationProvider bloc={new AnimeNotificationProviderBloc({ notifications, once })} />
  {/key}

  <AnimeNotificationStoreProbe {store} {initializeCalls} {claimed} {requests} />

  <button onclick={() => (mounts += 1)}>
    Remount the provider ({mounts + 1} {mounts === 0 ? 'mount' : 'mounts'} so far)
  </button>
</div>

<style>
  .frame {
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }

  button {
    font: inherit;
    font-size: 13px;
    padding: 7px 14px;
    border-radius: var(--weeb-radius-sm);
    border: 1px solid var(--weeb-border);
    background: var(--weeb-surface);
    color: var(--weeb-fg);
    cursor: pointer;
  }

  button:hover {
    background: var(--weeb-surface-hover);
  }
</style>
