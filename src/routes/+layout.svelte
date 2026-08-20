<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { getQueryClient, createQueryClient } from '../svelte/services/query-client';
  import Header from '$lib/Header.svelte';
  import Footer from '../svelte/components/Footer.svelte';
  import GlobalToaster from '../svelte/components/GlobalToaster.svelte';
  import AnimeNotificationProvider from '../svelte/components/AnimeNotificationProvider.svelte';
  import MobileDrawer from '../svelte/components/MobileDrawer.svelte';
  import {
    initGlobalErrorHandlers,
    initPostHogWhenConfigured,
    showInstantFeedback,
    hideNavigationFeedback
  } from '$lib/client/global-ui';
  import { initTelemetryWhenConfigured } from '$lib/client/telemetry';
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
    // Loads the OTel web SDK dynamically, so it stays off the first-paint path.
    initTelemetryWhenConfigured();
    import('../scripts/init-swipe-navigation');
  });

  beforeNavigate(() => showInstantFeedback());
  afterNavigate(() => hideNavigationFeedback());
</script>

<QueryClientProvider client={queryClient}>
<!-- The homepage runs its key art up under the bar, so the bar starts transparent
     there and takes its glass on scroll. Resolved from the route during SSR, so
     there is no flash of the solid bar on hydration. -->
<Header
  ssrAuth={data.auth}
  overlay={$page.route.id === '/' ||
    $page.route.id === '/anime/[slug]' ||
    $page.route.id === '/show/[id]'}
/>

<!-- Main content — always full width, components handle their own padding -->
<main class="w-full bg-weeb-bg text-weeb-fg min-h-screen">
  <slot />
</main>

<Footer />

<!-- Mobile Drawer (rendered at body level to escape nav stacking context) -->
<MobileDrawer />

<!-- Global Toast Configuration -->
<GlobalToaster />

<!-- Anime Notifications -->
<AnimeNotificationProvider />
</QueryClientProvider>
