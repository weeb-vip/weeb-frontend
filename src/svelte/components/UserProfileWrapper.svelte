<script lang="ts">
  import { onMount } from 'svelte';
  import { derived } from 'svelte/store';
  import { createQuery } from '@tanstack/svelte-query';
  import { loggedInStore } from '../stores/auth';
  import { userQueryOptions } from '../services/queries';
  import ProfileDropdown from './ProfileDropdown.svelte';
  import ProfileAvatar from './ProfileAvatar.svelte';
  import Button from './Button.svelte';
  import { openMobileDrawer } from '../stores/mobileDrawer';

  export let isMobile: boolean = false;
  export let onProfileClick: (() => void) | null = null;

  // Shape expected by ProfileDropdown's `user` prop
  type ProfileUser = {
    id: string;
    username: string;
    firstname: string;
    lastname: string;
    email?: string | null;
    profileImageUrl?: string | null;
  };

  let isLoggedIn = false;

  // Subscribe to auth state
  onMount(() => {
    const unsubscribe = loggedInStore.subscribe(state => {
      isLoggedIn = state.isLoggedIn;
    });
    return unsubscribe;
  });

  // Create the query during component init (context is only available
  // here) with a reactive enabled flag — lazily calling useUser() from a
  // reactive block threw "No QueryClient was found in Svelte context"
  const userQuery = createQuery(
    derived(loggedInStore, (state) => userQueryOptions(state.isLoggedIn))
  );

  $: user = userQuery ? $userQuery?.data : null;
  $: isLoading = userQuery ? $userQuery?.isLoading : false;
  $: hasError = userQuery ? $userQuery?.isError : false;

  // Fallback user data when the query fails but we are actually logged in.
  //
  // This used to require the error message to contain "Access denied", so any
  // other failure -- a network error, a timeout, a 500, an auth error worded
  // differently -- left displayUser null and dropped through to the branch
  // below, which renders a pulsing skeleton with nothing to resolve it. Users
  // saw an empty avatar and a grey bar that animated forever.
  //
  // Being logged in and having the query fail is enough. What we render from
  // this is an initial in a circle; getting that slightly generic is much
  // better than appearing permanently stuck.
  //
  // The fallback intentionally only carries the fields we render; cast to the
  // dropdown's expected shape (unchanged runtime behavior).
  $: fallbackUser = hasError && isLoggedIn ? ({
    username: 'User',
    profileImageUrl: null
  } as Partial<ProfileUser> as ProfileUser) : null;

  $: displayUser = user || fallbackUser;

  function handleMobileProfileClick() {
    openMobileDrawer();
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
      <div class="w-10 h-10 bg-weeb-surface rounded-full animate-pulse"></div>
      {#if !isMobile}
        <div class="w-16 h-4 bg-weeb-surface rounded animate-pulse"></div>
      {/if}
    </div>
  {:else if displayUser}
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
    <!-- Logged in, the query has settled, and there is still no user. The
         skeleton does not pulse here: it is not loading, and animating it told
         users to keep waiting for something that was never going to arrive. -->
    <div class="flex items-center space-x-2">
      <div class="w-10 h-10 bg-weeb-surface rounded-full"></div>
      {#if !isMobile}
        <div class="w-16 h-4 bg-weeb-surface rounded"></div>
      {/if}
    </div>
  {/if}
{:else}
  <!-- Not logged in -->
  {#if isMobile}
    <!-- Mobile: Hamburger menu button -->
    <button class="p-4" aria-label="Open menu" on:click={handleMobileProfileClick}>
      <svg class="w-6 h-6 text-weeb-fg-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
    </button>
  {:else}
    <!-- Desktop: Login/Register buttons -->
    <div class="flex items-center space-x-3">
      <Button color="blue" label="Login" onClick={handleLoginClick} />
      <Button color="transparent" label="Register" onClick={handleRegisterClick} />
    </div>
  {/if}
{/if}

