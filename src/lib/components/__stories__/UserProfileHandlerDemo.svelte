<script lang="ts">
  import { untrack } from 'svelte';
  import { get } from 'svelte/store';
  import UserProfileHandler from '$lib/components/shell/UserProfileHandler';
  import { loggedInStore } from '$lib/stores/auth';
  import { getQueryClient } from '$lib/services/query-client';
  import { queryKeys } from '$lib/services/query-hooks';
  import ProviderPanel from './ProviderPanel.svelte';
  import { installOfflineFetch, networkRow, SESSION_USER, type PanelRow } from './provider-stubs';

  /**
   * The header's account slot. It owns no state and draws no markup of its own:
   * it is `ConfigProvider`, `QueryProvider` and `UserProfileWrapper` inside
   * them -- so it rendering AT ALL is the composition working, since the
   * wrapper's bloc calls `createQuery`, which needs a QueryClient out of
   * context during initialisation.
   *
   * It takes no bloc, so there is nothing to inject: the story stubs what the
   * real bloc READS instead. The auth store is set directly (not through
   * `setLoggedIn`, which would identify a fictional user to PostHog) and the
   * user query is answered from the cache, seeded fresh so `refetchOnMount`
   * finds nothing stale to go and fetch. Both are module singletons and both
   * are handed back on teardown.
   */
  let {
    signedIn = false,
    isMobile = false,
  }: {
    signedIn?: boolean;
    isMobile?: boolean;
  } = $props();

  let requests = $state(0);
  const restoreFetch = installOfflineFetch(() => (requests += 1));

  const client = untrack(() => getQueryClient());
  const previousAuth = untrack(() => get(loggedInStore));

  if (untrack(() => signedIn)) {
    client.setQueryData(queryKeys.user(), SESSION_USER);
    loggedInStore.set({ isLoggedIn: true, isAuthInitialized: true });
  } else {
    loggedInStore.set({ isLoggedIn: false, isAuthInitialized: true });
  }

  const rows = $derived<PanelRow[]>([
    { label: 'providers supplied', value: 'ConfigProvider → QueryProvider' },
    {
      label: 'UserProfileWrapper mounted',
      value: 'yes — createQuery found a client in context',
      tone: 'ok',
    },
    { label: 'auth store', value: signedIn ? 'isLoggedIn: true' : 'isLoggedIn: false' },
    {
      label: 'user query',
      value: signedIn ? `answered from cache: ${SESSION_USER.username}` : 'disabled while signed out',
    },
    networkRow(requests),
  ]);

  $effect(() => () => {
    client.removeQueries({ queryKey: queryKeys.user() });
    loggedInStore.set(previousAuth);
    restoreFetch();
  });
</script>

<div class="frame">
  <!-- A stand-in for the header bar, so the slot sits where it does in the app. -->
  <div class="bar" class:mobile={isMobile}>
    <span class="brand">weeb.vip</span>
    <UserProfileHandler {isMobile} />
  </div>

  <ProviderPanel
    title="What UserProfileHandler supplies"
    note="It renders nothing of its own — it is two providers wrapped around the account slot. The bar above is the slot they let render; the rows are what made that possible."
    {rows}
  />
</div>

<style>
  .frame {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 18px;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    background: var(--weeb-bg-elevated);
  }

  .bar.mobile {
    max-width: 380px;
  }

  .brand {
    font-weight: 600;
    font-size: 15px;
    color: var(--weeb-fg);
  }
</style>
