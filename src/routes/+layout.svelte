<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { getQueryClient, createQueryClient } from '../svelte/services/query-client';
  import Header from '$lib/Header.svelte';
  import Footer from '../svelte/components/Footer.svelte';
  import DevTestingPanel from '../svelte/components/DevTestingPanel.svelte';
  import GlobalToaster from '../svelte/components/GlobalToaster.svelte';
  import AnimeNotificationProvider from '../svelte/components/AnimeNotificationProvider.svelte';
  import MobileDrawer from '../svelte/components/MobileDrawer.svelte';
  import {
    initGlobalErrorHandlers,
    initPostHogWhenConfigured,
    showInstantFeedback,
    hideNavigationFeedback
  } from '$lib/client/global-ui';
  import { configStore } from '../svelte/stores/config';
  import '../scss/base.scss';
  import '../styles/design-tokens.css';

  export let data;

  // Config is loaded once (build-time import → locals → layout data). Seed the
  // client store from it so nothing needs to re-fetch /config.json. Runs during
  // both SSR and client hydration; the store is shared but config isn't
  // per-user, so that's safe.
  configStore.hydrate(data.config);

  // One QueryClient for the whole app via context. In the browser this is
  // the shared singleton; during SSR each layout render gets a fresh
  // client so per-user data never leaks between concurrent requests.
  const queryClient = browser ? getQueryClient() : createQueryClient();

  onMount(() => {
    initGlobalErrorHandlers();
    initPostHogWhenConfigured();
    import('../scripts/init-swipe-navigation');
  });

  beforeNavigate(() => showInstantFeedback());
  afterNavigate(() => hideNavigationFeedback());
</script>

<QueryClientProvider client={queryClient}>
<Header ssrAuth={data.auth} />

<!-- Main content — always full width, components handle their own padding -->
<main class="w-full bg-weeb-bg text-weeb-fg min-h-screen">
  <slot />
</main>

<Footer />

<!-- Mobile Drawer (rendered at body level to escape nav stacking context) -->
<MobileDrawer />

<!-- Global Toast Configuration -->
<GlobalToaster />

<!-- Dev Testing Panel -->
{#if __ENABLE_DEV_FEATURES__}
  <DevTestingPanel />
{/if}

<!-- Anime Notifications -->
<AnimeNotificationProvider />
</QueryClientProvider>
