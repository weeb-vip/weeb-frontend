<script lang="ts">
  import AutocompleteAdvanced from '../svelte/components/AutocompleteAdvanced.svelte';
  import LoginModalHandler from '../svelte/components/LoginModalHandler.svelte';
  import UserProfileHandler from '../svelte/components/UserProfileHandler.svelte';
  import AuthInitializer from '../svelte/components/AuthInitializer.svelte';
  import TitleLanguageToggle from '../svelte/components/TitleLanguageToggle.svelte';

  export let ssrAuth: any;

  function getCurrentSeason(): string {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    if (month >= 0 && month <= 2) return `WINTER_${year}`;
    if (month >= 3 && month <= 5) return `SPRING_${year}`;
    if (month >= 6 && month <= 8) return `SUMMER_${year}`;
    return `FALL_${year}`;
  }
</script>

<nav class="nav" id="main-header">
  <!-- Logo -->
  <a href="/" class="nav-logo">
    <img
      src="https://cdn.weeb.vip/images/logo6-rev-sm_sm.png"
      alt="weeb.vip"
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
    <a href="/">Home</a>
    <a href={`/season/${getCurrentSeason()}`}>Season</a>
    <a href="/airing">Airing</a>
    <a href="/search">Browse</a>
  </div>

  <!-- Search -->
  <div class="nav-search">
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

  .nav-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: var(--weeb-fg);
    font-weight: 700;
    font-size: 18px;
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
  .nav-links a {
    padding: 6px 14px;
    border-radius: 6px;
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
</style>
