<script lang="ts">
  import { onMount, untrack, type Snippet } from 'svelte';
  import { browser } from '$app/environment';
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { getQueryClient, createQueryClient } from '$lib/services/query-client';
  import Header from '$lib/components/shell/Header';
  import Footer from '$lib/components/shell/Footer';
  import GlobalToaster from '$lib/components/shell/GlobalToaster';
  import AnimeNotificationProvider from '$lib/components/shell/AnimeNotificationProvider';
  import MobileDrawer from '$lib/components/shell/MobileDrawer';
  import {
    initGlobalErrorHandlers,
    initPostHogWhenConfigured,
    showInstantFeedback,
    hideNavigationFeedback
  } from '$lib/client/global-ui';
  import { initTelemetryWhenConfigured } from '$lib/client/telemetry';
  import { gateSessionReplay } from '$lib/client/session-replay';
  import { loggedInStore, loginModalStore } from '$lib/stores/auth';
  import { derived } from 'svelte/store';
  import { configStore } from '$lib/stores/config';
  import { provideServerAuth } from '$lib/stores/server-auth';
  import { imagePolicyFor, provideImagePolicy } from '$lib/stores/image-policy';
  import '../scss/base.scss';
  import '../styles/design-tokens.css';

  let { data, children }: { data: any; children?: Snippet } = $props();

  // Config is loaded once (build-time import → locals → layout data). Seed the
  // client store from it so nothing needs to re-fetch /config.json. Runs during
  // both SSR and client hydration; the store is shared but config isn't
  // per-user, so that's safe. Read untracked: hydrate() is first-value-wins, so
  // only the initial value can ever matter.
  configStore.hydrate(untrack(() => data.config));

  // The server's auth answer, as a per-request context value: components that
  // gate on `loggedInStore` (which starts signed out and only resolves in the
  // browser) believe this until the store has resolved, so a logged-in
  // response renders logged in. See $lib/stores/server-auth.
  provideServerAuth(untrack(() => data.auth));

  // Lighter images for a visitor who sent Save-Data; the default for everyone
  // else. Per request, like the auth answer. See $lib/stores/image-policy.
  provideImagePolicy(imagePolicyFor(untrack(() => data.saveData)));

  // One QueryClient for the whole app via context. In the browser this is
  // the shared singleton; during SSR each layout render gets a fresh
  // client so per-user data never leaks between concurrent requests.
  const queryClient = browser ? getQueryClient() : createQueryClient();

  onMount(() => {
    initGlobalErrorHandlers();
    initPostHogWhenConfigured();
    // Session replay only for signed-in users and the sign-up/sign-in funnel.
    const replayGate = derived([loggedInStore, loginModalStore, page], ([auth, modal, p]) => ({
      isLoggedIn: auth.isLoggedIn,
      modalOpen: modal.isOpen,
      pathname: p.url.pathname
    }));
    const stopReplayGate = gateSessionReplay(replayGate);
    // Loads the OTel web SDK dynamically, so it stays off the first-paint path.
    initTelemetryWhenConfigured();
    import('../scripts/init-swipe-navigation');
    return () => stopReplayGate();
  });

  beforeNavigate(() => showInstantFeedback());
  afterNavigate(() => hideNavigationFeedback());
</script>

<QueryClientProvider client={queryClient}>
<!-- The homepage runs its key art up under the bar, so the bar starts transparent
     there and takes its glass on scroll. Resolved from the route during SSR, so
     there is no flash of the solid bar on hydration. -->
<!-- First in the document so it is the first thing Tab reaches. Placed after
     the header it was the eleventh stop, which is decoration rather than a skip. -->
<a class="skip-link" href="#main-content">Skip to content</a>

<Header
  ssrAuth={data.auth}
  overlay={$page.route.id === '/' ||
    $page.route.id === '/anime/[slug]' ||
    $page.route.id === '/show/[id]'}
/>

<!-- Main content — always full width, components handle their own padding.
     tabindex="-1" so the skip link can actually move focus here; without it the
     browser jumps the viewport but leaves focus back in the header. -->
<main id="main-content" tabindex="-1" class="w-full bg-weeb-bg text-weeb-fg min-h-screen">
  {@render children?.()}
</main>

<Footer />

<!-- Mobile Drawer (rendered at body level to escape nav stacking context) -->
<MobileDrawer />

<!-- Global Toast Configuration -->
<GlobalToaster />

<!-- Anime Notifications -->
<AnimeNotificationProvider />
</QueryClientProvider>
