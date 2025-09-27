<script lang="ts">
  import { onMount } from 'svelte';
  import { loggedInStore } from '../stores/auth';
  import { useUser } from '../services/queries';
  import ProfileDropdown from './ProfileDropdown.svelte';
  import ProfileAvatar from './ProfileAvatar.svelte';

  export let isMobile: boolean = false;
  export let onProfileClick: (() => void) | null = null;

  let isLoggedIn = false;
  let userQuery: any = null;
  let mobileDrawerOpen = false;

  // Subscribe to auth state
  onMount(() => {
    const unsubscribe = loggedInStore.subscribe(state => {
      isLoggedIn = state.isLoggedIn;
    });
    return unsubscribe;
  });

  // Initialize user query when logged in (this will be inside QueryClientProvider)
  $: if (isLoggedIn && !userQuery) {
    try {
      userQuery = useUser();
    } catch (error) {
      console.error('Failed to initialize user query:', error);
    }
  }

  $: user = userQuery ? $userQuery?.data : null;
  $: isLoading = userQuery ? $userQuery?.isLoading : false;
  $: hasError = userQuery ? $userQuery?.isError : false;

  // Fallback user data when query fails but we're actually logged in
  // Only use fallback if user query specifically failed with access denied
  $: fallbackUser = hasError && isLoggedIn && userQuery &&
    $userQuery?.error?.message?.includes('Access denied') ? {
    username: 'User',
    profileImageUrl: null
  } : null;

  function handleMobileProfileClick() {
    mobileDrawerOpen = true;
    if (onProfileClick) {
      onProfileClick();
    }
  }

  function handleLoginClick() {
    window.dispatchEvent(new CustomEvent('openLogin'));
  }

  function handleRegisterClick() {
    window.dispatchEvent(new CustomEvent('openRegister'));
  }
</script>

{#if isLoggedIn}
  {#if isLoading}
    <!-- Loading skeleton -->
    <div class="flex items-center space-x-2">
      <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
      {#if !isMobile}
        <div class="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      {/if}
    </div>
  {:else if user || fallbackUser}
    {@const displayUser = user || fallbackUser}
    {#if isMobile}
      <!-- Mobile: Just avatar that opens menu -->
      <button class="p-2" aria-label="Open menu" on:click={handleMobileProfileClick}>
        <ProfileAvatar
          username={displayUser.username}
          profileImageUrl={displayUser.profileImageUrl}
          size="sm"
          linkToProfile={false}
          className="!cursor-pointer"
        />
      </button>
    {:else}
      <!-- Desktop: Profile dropdown -->
      <ProfileDropdown user={displayUser} />
    {/if}
  {:else}
    <!-- Still loading or no data yet - show loading skeleton -->
    <div class="flex items-center space-x-2">
      <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
      {#if !isMobile}
        <div class="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      {/if}
    </div>
  {/if}
{:else}
  <!-- Not logged in -->
  {#if isMobile}
    <!-- Mobile: Hamburger menu button -->
    <button class="p-4" aria-label="Open menu" on:click={handleMobileProfileClick}>
      <svg class="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
    </button>
  {:else}
    <!-- Desktop: Login/Register buttons -->
    <div class="flex items-center space-x-4">
      <button
        class="px-4 py-2 relative rounded-full font-medium transition-colors duration-300 flex items-center justify-center whitespace-nowrap w-fit bg-blue-600 hover:bg-blue-700 text-white"
        on:click={handleLoginClick}
      >
        Login
      </button>

      <button
        class="px-4 py-2 relative rounded-full font-medium transition-colors duration-300 flex items-center justify-center whitespace-nowrap w-fit bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600"
        on:click={handleRegisterClick}
      >
        Register
      </button>
    </div>
  {/if}
{/if}

<!-- Mobile Drawer -->
{#if isMobile}
  {#await import('./MobileDrawer.svelte') then { default: MobileDrawer }}
    <MobileDrawer
      isOpen={mobileDrawerOpen}
      onClose={() => mobileDrawerOpen = false}
      {user}
      {isLoggedIn}
    />
  {/await}
{/if}