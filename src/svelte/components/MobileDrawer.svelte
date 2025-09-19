<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { loggedInStore } from '../stores/auth';
  import { navigateWithTransition } from '../../utils/astro-navigation';
  import { AuthStorage } from '../../utils/auth-storage';
  import ProfileAvatar from './ProfileAvatar.svelte';

  export let isOpen = false;
  export let onClose: () => void;
  export let user: any = null;
  export let isLoggedIn = false;

  let drawerElement: HTMLDivElement;
  let mounted = false;

  onMount(() => {
    mounted = true;
    // Lock body scroll when drawer is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  });

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

  function handleLogout() {
    AuthStorage.clearTokens();
    loggedInStore.logout();
    onClose();
    navigateWithTransition("/");
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

  function toggleDarkMode() {
    const isDarkMode = document.documentElement.classList.contains('dark');
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  }

  let isDarkMode = false;

  $: if (typeof window !== 'undefined') {
    isDarkMode = document.documentElement.classList.contains('dark');
  }
</script>

{#if isOpen}
  <!-- Backdrop with fade animation -->
  <div
    class="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
    on:click={handleBackdropClick}
    bind:this={drawerElement}
    transition:fade={{ duration: 300, easing: cubicOut }}
  >
    <!-- Slide-over panel from right -->
    <div class="fixed inset-y-0 right-0 w-full max-w-sm"
      transition:fly={{
        x: '100%',
        duration: 300,
        easing: cubicOut,
        opacity: 1
      }}
      on:click|stopPropagation
    >
      <div class="h-full bg-white dark:bg-gray-900 flex flex-col shadow-2xl p-6 overflow-y-auto">
        <!-- Header with logo + close -->
        <div class="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <a href="/" on:click={handleLinkClick} class="flex items-center space-x-4">
            <img
              src="https://cdn.weeb.vip/images/logo6-rev-sm_sm.png"
              alt="logo"
              width="40"
              height="40"
              loading="eager"
              decoding="async"
              class="w-10 h-10"
            />
            <!-- WeebVip Wordmark -->
            <div class="inline-flex items-center gap-2" role="img" aria-label="WEEB VIP wordmark">
              <span class="relative inline-grid select-none whitespace-nowrap flex-shrink-0">
                <span class="col-start-1 row-start-1 font-light text-transparent bg-clip-text text-center bg-gray-800 dark:bg-gray-300 text-2xl tracking-[0.25em] transition-all duration-300">
                  WEEB
                </span>
              </span>
              <span class="inline-flex items-center gap-3 px-3 py-1.5 rounded-2xl dark:bg-slate-900/80 ring-1 ring-slate-700 dark:ring-slate-300/20 transition-all duration-300">
                <span class="text-gray-800 dark:text-slate-50 font-black font-light tracking-[0.35em] transition-colors duration-300 text-sm">VIP</span>
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 transition-all duration-300" aria-hidden="true"></span>
              </span>
            </div>
          </a>
          <button
            class="p-2 -m-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            on:click={onClose}
            aria-label="Close menu"
          >
            <svg class="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 flex flex-col justify-start space-y-4">
          {#if isLoggedIn && user}
            <!-- User Profile Section -->
            <div class="rounded-lg bg-gray-50 dark:bg-gray-800/50 overflow-hidden transition-colors duration-300">
              <a
                href="/profile"
                on:click={handleLinkClick}
                class="flex items-center px-4 py-4 space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors duration-300"
              >
                <ProfileAvatar
                  username={user.username}
                  profileImageUrl={user.profileImageUrl}
                  size="md"
                  linkToProfile={false}
                />
                <div class="flex-1">
                  <p class="font-semibold text-gray-900 dark:text-gray-100 transition-colors duration-300">{user.username}</p>
                  <p class="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">{user.firstname} {user.lastname}</p>
                </div>
              </a>
              <div class="border-t border-gray-200 dark:border-gray-600 transition-colors duration-300">
                <button
                  on:click={handleLogout}
                  class="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors duration-300"
                >
                  Sign Out
                </button>
              </div>
            </div>
          {/if}

          <!-- Dark Mode Toggle -->
          <div class="flex items-center justify-between px-4 py-4 rounded">
            <span class="text-lg text-gray-900 dark:text-gray-100">
              {isDarkMode ? "Light Mode" : "Dark Mode"}
            </span>
            <button
              on:click={toggleDarkMode}
              class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300"
              aria-label="Toggle dark mode"
            >
              <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {#if isDarkMode}
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
                {:else}
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
                {/if}
              </svg>
            </button>
          </div>

          {#if !isLoggedIn}
            <!-- Login/Register Buttons -->
            <button
              on:click={handleLoginClick}
              class="w-full text-left px-4 py-4 rounded-lg text-lg font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-[0.98] transition-all"
            >
              <div class="flex items-center justify-between">
                <span>Login</span>
                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
            <button
              on:click={handleRegisterClick}
              class="w-full text-left px-4 py-4 rounded-lg text-lg font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-[0.98] transition-all"
            >
              <div class="flex items-center justify-between">
                <span>Register</span>
                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          {/if}
        </div>

        <!-- Footer -->
        <div class="text-center py-4 border-t border-gray-200 dark:border-gray-700">
          <span class="text-xs text-gray-400 dark:text-gray-500">Version 1.0.0</span>
        </div>
      </div>
    </div>
  </div>
{/if}
