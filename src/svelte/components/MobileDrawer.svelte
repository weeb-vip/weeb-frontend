<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { loggedInStore } from '../stores/auth';
  import { navigateWithTransition } from '../../utils/astro-navigation';
  import { AuthStorage } from '../../utils/auth-storage';
  import { preferencesStore } from '../stores/preferences';
  import { mobileDrawerOpen, closeMobileDrawer } from '../stores/mobileDrawer';
  import { useUser } from '../services/queries';
  import { logout } from '../../services/queries';
  import ProfileAvatar from './ProfileAvatar.svelte';

  const version = __APP_VERSION__;

  let isLoggedIn = false;
  let userQuery: any = null;

  $: isOpen = $mobileDrawerOpen;

  function onClose() {
    closeMobileDrawer();
  }

  let mounted = false;

  onMount(() => {
    mounted = true;

    // Subscribe to auth state
    const unsubscribe = loggedInStore.subscribe(state => {
      isLoggedIn = state.isLoggedIn;
    });

    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      unsubscribe();
      document.body.style.overflow = '';
    };
  });

  // Initialize user query when logged in
  $: if (isLoggedIn && !userQuery) {
    try {
      userQuery = useUser();
    } catch (error) {
      console.error('Failed to initialize user query:', error);
    }
  }

  $: user = userQuery ? $userQuery?.data : null;

  $: if (typeof window !== 'undefined') {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleLinkClick() {
    onClose();
  }

  function handleLoginClick() {
    onClose();
    window.dispatchEvent(new CustomEvent('openLogin'));
  }

  function handleRegisterClick() {
    onClose();
    window.dispatchEvent(new CustomEvent('openRegister'));
  }

  function getCurrentSeason(): string {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    if (month >= 0 && month <= 2) return `WINTER_${year}`;
    if (month >= 3 && month <= 5) return `SPRING_${year}`;
    if (month >= 6 && month <= 8) return `SUMMER_${year}`;
    return `FALL_${year}`;
  }

  const navLinks = [
    { href: '/', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: `/season/${typeof window !== 'undefined' ? getCurrentSeason() : 'SPRING_2026'}`, label: 'Season', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { href: '/airing', label: 'Airing', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
    { href: '/search', label: 'Browse', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  ];

  const userLinks = [
    { href: '/profile', label: 'My Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { href: '/profile/anime', label: 'My Anime List', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
    { href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  ];

  async function handleLogout() {
    try {
      const logoutQuery = logout();
      await logoutQuery.mutationFn();
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch (error) {
      console.error("Logout error:", error);
    }
    AuthStorage.logout();
    loggedInStore.logout();
    onClose();
    navigateWithTransition("/");
  }
</script>

{#if isOpen}
  <div
    class="drawer-backdrop"
    on:click={handleBackdropClick}
    transition:fade={{ duration: 200, easing: cubicOut }}
  >
    <div
      class="drawer-panel"
      on:click|stopPropagation
      transition:fly={{ x: '100%', duration: 280, easing: cubicOut, opacity: 1 }}
    >
      <!-- Header -->
      <div class="drawer-header">
        <a href="/" on:click={handleLinkClick} class="drawer-logo">
          <img
            src="https://cdn.weeb.vip/images/logo6-rev-sm_sm.png"
            alt="weeb.vip"
            width="32"
            height="32"
            loading="eager"
            class="drawer-logo-img"
          />
          <span class="drawer-logo-text">weeb.vip</span>
        </a>
        <button class="drawer-close" on:click={onClose} aria-label="Close menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- User card (if logged in) -->
      {#if isLoggedIn && user}
        <a href="/profile" on:click={handleLinkClick} class="drawer-user-card">
          <ProfileAvatar
            username={user.username}
            profileImageUrl={user.profileImageUrl}
            size="md"
            linkToProfile={false}
          />
          <div class="drawer-user-info">
            <span class="drawer-user-name">{user.username}</span>
            <span class="drawer-user-sub">{user.firstname} {user.lastname}</span>
          </div>
          <svg class="drawer-user-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </a>
      {/if}

      <!-- Navigation -->
      <nav class="drawer-nav">
        <div class="drawer-nav-label">Navigate</div>
        {#each navLinks as link}
          <a href={link.href} on:click={handleLinkClick} class="drawer-nav-item">
            <svg class="drawer-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d={link.icon} />
            </svg>
            <span>{link.label}</span>
          </a>
        {/each}
      </nav>

      <!-- Account section (if logged in) -->
      {#if isLoggedIn}
        <div class="drawer-nav">
          <div class="drawer-nav-label">Account</div>
          {#each userLinks as link}
            <a href={link.href} on:click={handleLinkClick} class="drawer-nav-item">
              <svg class="drawer-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d={link.icon} />
              </svg>
              <span>{link.label}</span>
            </a>
          {/each}
        </div>
      {/if}

      <!-- Settings -->
      <div class="drawer-settings">
        <div class="drawer-nav-label">Settings</div>
        <div class="drawer-setting-row">
          <span>Title Language</span>
          <button
            class="drawer-lang-toggle"
            on:click={() => preferencesStore.toggleTitleLanguage()}
            aria-label="Toggle title language"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            <span>{$preferencesStore.titleLanguage === 'english' ? 'EN' : 'JP'}</span>
          </button>
        </div>
      </div>

      <!-- Spacer -->
      <div class="drawer-spacer"></div>

      <!-- Sign out (if logged in) -->
      {#if isLoggedIn}
        <div class="drawer-logout-section">
          <button class="drawer-logout-btn" on:click={handleLogout}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      {/if}

      <!-- Auth buttons (if not logged in) -->
      {#if !isLoggedIn}
        <div class="drawer-auth">
          <button class="drawer-btn-primary" on:click={handleLoginClick}>
            Login
          </button>
          <button class="drawer-btn-ghost" on:click={handleRegisterClick}>
            Register
          </button>
        </div>
      {/if}

      <!-- Footer -->
      <div class="drawer-footer">
        <span>v{version}</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: oklch(0% 0 0 / 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .drawer-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: 320px;
    background: var(--weeb-bg-elevated);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px);
  }

  /* Header */
  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--weeb-border);
    flex-shrink: 0;
  }
  .drawer-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--weeb-fg);
  }
  .drawer-logo-img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }
  .drawer-logo-text {
    font-weight: 700;
    font-size: 17px;
    letter-spacing: -0.02em;
  }
  .drawer-close {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--weeb-radius);
    color: var(--weeb-fg-muted);
    transition: background 0.15s, color 0.15s;
  }
  .drawer-close:hover {
    background: var(--weeb-surface);
    color: var(--weeb-fg);
  }

  /* User card */
  .drawer-user-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--weeb-border);
    text-decoration: none;
    color: var(--weeb-fg);
    transition: background 0.15s;
  }
  .drawer-user-card:hover, .drawer-user-card:active {
    background: var(--weeb-surface);
  }
  .drawer-user-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .drawer-user-name {
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .drawer-user-sub {
    font-size: 13px;
    color: var(--weeb-fg-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .drawer-user-chevron {
    flex-shrink: 0;
    color: var(--weeb-fg-muted);
  }

  /* Navigation */
  .drawer-nav {
    padding: 12px 0;
  }
  .drawer-nav-label {
    padding: 8px 20px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted);
  }
  .drawer-nav-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 20px;
    font-size: 15px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }
  .drawer-nav-item:hover, .drawer-nav-item:active {
    background: var(--weeb-surface);
    color: var(--weeb-fg);
  }
  .drawer-nav-icon {
    flex-shrink: 0;
    color: var(--weeb-fg-muted);
  }
  .drawer-nav-item:hover .drawer-nav-icon,
  .drawer-nav-item:active .drawer-nav-icon {
    color: var(--weeb-accent);
  }

  /* Settings */
  .drawer-settings {
    padding: 4px 0 12px;
    border-top: 1px solid var(--weeb-border);
  }
  .drawer-setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    font-size: 15px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
  }
  .drawer-lang-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: var(--weeb-radius);
    background: var(--weeb-surface);
    color: var(--weeb-fg-secondary);
    font-size: 13px;
    font-weight: 600;
    transition: background 0.15s, color 0.15s;
  }
  .drawer-lang-toggle:hover {
    background: var(--weeb-surface-hover);
    color: var(--weeb-fg);
  }

  /* Spacer */
  .drawer-spacer {
    flex: 1;
  }

  /* Auth buttons */
  .drawer-auth {
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-top: 1px solid var(--weeb-border);
  }
  .drawer-btn-primary {
    width: 100%;
    padding: 12px;
    border-radius: var(--weeb-radius);
    background: var(--weeb-accent);
    color: white;
    font-size: 15px;
    font-weight: 600;
    text-align: center;
    transition: background 0.15s;
  }
  .drawer-btn-primary:hover {
    background: var(--weeb-accent-hover);
  }
  .drawer-btn-ghost {
    width: 100%;
    padding: 12px;
    border-radius: var(--weeb-radius);
    background: transparent;
    border: 1px solid var(--weeb-border);
    color: var(--weeb-fg-secondary);
    font-size: 15px;
    font-weight: 600;
    text-align: center;
    transition: background 0.15s, color 0.15s;
  }
  .drawer-btn-ghost:hover {
    background: var(--weeb-surface);
    color: var(--weeb-fg);
  }

  /* Logout */
  .drawer-logout-section {
    padding: 8px 20px 16px;
    border-top: 1px solid var(--weeb-border);
  }
  .drawer-logout-btn {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 12px 0;
    font-size: 15px;
    font-weight: 500;
    color: var(--weeb-red);
    transition: opacity 0.15s;
  }
  .drawer-logout-btn:hover, .drawer-logout-btn:active {
    opacity: 0.8;
  }

  /* Footer */
  .drawer-footer {
    padding: 12px 20px;
    text-align: center;
    font-size: 12px;
    font-family: var(--weeb-font-mono);
    color: var(--weeb-fg-muted);
    border-top: 1px solid var(--weeb-border);
    flex-shrink: 0;
  }
</style>
