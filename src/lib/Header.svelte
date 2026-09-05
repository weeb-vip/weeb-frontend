<script lang="ts">
  import { untrack } from 'svelte';
  import AutocompleteAdvanced from '../svelte/components/AutocompleteAdvanced.svelte';
  import LoginModalHandler from '../svelte/components/LoginModalHandler.svelte';
  import UserProfileHandler from '../svelte/components/UserProfileHandler.svelte';
  import AuthInitializer from '../svelte/components/AuthInitializer.svelte';
  import TitleLanguageToggle from '../svelte/components/TitleLanguageToggle.svelte';
  import { HeaderBloc } from './Header.bloc.svelte';

  let {
    ssrAuth,
    overlay = false,
    bloc: injected = undefined
  }: {
    ssrAuth: any;
    /** When true the bar starts transparent over page artwork and takes its
        glass on scroll. Pages without artwork behind the nav leave this false. */
    overlay?: boolean;
    bloc?: HeaderBloc;
  } = $props();

  const bloc = untrack(() => injected ?? new HeaderBloc({ overlay }));

  // `overlay` is derived from the route at the call site, so it changes under
  // us on navigation.
  $effect(() => bloc.setOverlay(overlay));

  // The frame loop the bloc runs has to stop with the component.
  $effect(() => () => bloc.destroy());
</script>

<svelte:window onscroll={bloc.overlay ? () => bloc.scrolled(window.scrollY) : undefined} />

<nav
  class="nav"
  class:nav--overlay={bloc.overlay}
  class:nav--glass={bloc.hasGlass}
  style="--nav-solid: {bloc.solid}"
  id="main-header"
  aria-label="Main"
>
  <!-- Logo -->
  <a href="/" class="nav-logo">
    <img
      src="https://cdn.weeb.vip/images/logo6-rev-sm_sm.png"
      alt=""
      width="32"
      height="32"
      loading="eager"
      decoding="async"
      class="nav-logo-img"
    />
    <span class="nav-logo-text">weeb.vip</span>
  </a>

  <!-- Nav Links (desktop only) -->
  <div class="nav-links">
    <a href="/" aria-current={bloc.isCurrent('/') ? 'page' : undefined}>Home</a>
    <a href={bloc.seasonHref} aria-current={bloc.isCurrent('/season') ? 'page' : undefined}>Season</a>
    <a href="/airing" aria-current={bloc.isCurrent('/airing') ? 'page' : undefined}>Airing</a>
    <a href="/search" aria-current={bloc.isCurrent('/search') ? 'page' : undefined}>Browse</a>
    <!-- /manga covers the detail route as well as the shelf, so reading a
         manga keeps its nav item lit. A light novel's detail page lives under
         /manga too and lights this one rather than its own; one row cannot
         have two detail URLs, and the alternative is neither lit. -->
    <a href="/manga" aria-current={bloc.isCurrent('/manga') ? 'page' : undefined}>Manga</a>
    <a href="/light-novels" aria-current={bloc.isCurrent('/light-novels') ? 'page' : undefined}>Light novels</a>
  </div>

  <!-- Search -->
  <div class="nav-search" role="search">
    <AutocompleteAdvanced />
  </div>

  <!-- Right: Language toggle + Auth -->
  <div class="nav-right">
    <TitleLanguageToggle />
    <UserProfileHandler isMobile={false} />
  </div>

  <!-- Mobile: simplified right side -->
  <div class="nav-right-mobile">
    <UserProfileHandler isMobile={true} />
  </div>
</nav>

<!-- Auth State Initializer with SSR auth data -->
<AuthInitializer {ssrAuth} />

<!-- Login/Register Modal Handler -->
<LoginModalHandler />

<style>
  .nav {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 24px;
    height: var(--weeb-nav-height, 60px);
    background: var(--weeb-glass-bg);
    backdrop-filter: var(--weeb-glass-blur);
    -webkit-backdrop-filter: var(--weeb-glass-blur);
    border-bottom: 1px solid var(--weeb-border);
  }

  /* Overlay pages drive every one of these off --nav-solid, so the bar dissolves
     into the artwork at the top and rebuilds itself continuously on scroll. */
  .nav--overlay {
    background: color-mix(in oklch, var(--weeb-glass-bg) calc(var(--nav-solid) * 100%), transparent);
    /* No backdrop-filter at rest. blur(0px) is visually a no-op but still creates
       a stacking context and forces a filter pass, which re-ran the autocomplete
       options' entrance animation on every keystroke and blinked them to zero
       opacity (see tests/e2e/search-autocomplete-responsiveness). The filter only
       turns on once there is actually something to blur. */
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border-bottom-color: color-mix(in oklch, var(--weeb-border) calc(var(--nav-solid) * 100%), transparent);
  }
  .nav--overlay.nav--glass {
    backdrop-filter: blur(calc(var(--nav-solid) * 24px)) saturate(calc(1 + var(--nav-solid) * 0.4));
    -webkit-backdrop-filter: blur(calc(var(--nav-solid) * 24px)) saturate(calc(1 + var(--nav-solid) * 0.4));
  }

  /* Secondary grey only clears 2.4:1 against pale key art, so every label in the
     bar rides up to full foreground while it is over artwork and settles back to
     its resting colour as the glass arrives. Applies to the right-hand cluster
     too: it was the half that still looked pasted on. */
  .nav--overlay .nav-links a,
  .nav--overlay :global(.nav-right a:not(.btn-accent)),
  .nav--overlay :global(.nav-right button:not(.btn-accent)),
  .nav--overlay :global(.nav-right-mobile button:not(.btn-accent)) {
    color: color-mix(in oklch, var(--weeb-fg-secondary) calc(var(--nav-solid) * 100%), var(--weeb-fg));
  }

  /* The search field was the one opaque object in a transparent bar, which is
     what read as a dark pill dropped on the artwork. It now starts as part of
     the overlay and firms up with everything else. */
  .nav--overlay .nav-search :global(input) {
    background: color-mix(in oklch, var(--weeb-surface) calc(72% + var(--nav-solid) * 28%), transparent);
    border-color: color-mix(in oklch, var(--weeb-border) calc(55% + var(--nav-solid) * 45%), transparent);
  }
  /* Muted placeholder over a translucent field on artwork is the weakest text in
     the bar; it rides up with everything else while the ground is uncertain. */
  .nav--overlay .nav-search :global(input::placeholder) {
    color: color-mix(in oklch, var(--weeb-fg-muted) calc(var(--nav-solid) * 100%), var(--weeb-fg-secondary));
  }

  .nav-logo {
    min-height: 44px;
    min-width: 44px;
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: var(--weeb-fg);
    font-weight: 700;
    font-size: 20px;
    letter-spacing: -0.02em;
    flex-shrink: 0;
  }
  .nav-logo-img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }
  .nav-logo-text {
    display: none;
  }

  .nav-links {
    display: none;
    gap: 4px;
    margin-left: 24px;
  }
  .nav-links a[aria-current='page'] {
    color: var(--weeb-accent-text);
  }
  .nav-links a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 6px 14px;
    border-radius: var(--weeb-radius, 8px);
    font-size: 14px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    text-decoration: none;
    transition: color 0.15s, background 0.15s;
  }
  .nav-links a:hover {
    color: var(--weeb-fg);
    background: var(--weeb-surface);
  }

  .nav-search {
    margin-left: auto;
    flex: 1;
    max-width: 320px;
    min-width: 0;
  }

  .nav-right {
    display: none;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .nav-right-mobile {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  /* Desktop: show nav links, logo text, right section */
  @media (min-width: 1024px) {
    .nav-logo-text { display: inline; }
    .nav-links { display: flex; }
    .nav-right { display: flex; }
    .nav-right-mobile { display: none; }
  }

  @media (max-width: 480px) {
    .nav {
      padding: 0 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .nav--overlay { transition: none; }
  }
</style>
