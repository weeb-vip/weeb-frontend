<script lang="ts">
  import { onMount } from 'svelte';
  import { loggedInStore } from '../stores/auth';
  import { navigateWithTransition } from '../../utils/astro-navigation';
  import { AuthStorage } from '../../utils/auth-storage';
  import ProfileAvatar from './ProfileAvatar.svelte';
  import { logout } from '../../services/queries';

  export let user: {
    id: string;
    username: string;
    firstname: string;
    lastname: string;
    email?: string | null;
    profileImageUrl?: string | null;
  };

  let isOpen = false;
  let dropdownRef: HTMLDivElement;

  onMount(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
        isOpen = false;
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });

  async function handleLogout() {
    try {
      // Call GraphQL logout mutation first
      const logoutQuery = logout();
      await logoutQuery.mutationFn();
      console.log("🚪 GraphQL logout successful");

      // Also call local API endpoint to ensure all cookies are cleared
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include' // Send cookies to server
      });
      console.log("🚪 Server logout successful - cookies cleared");
    } catch (error) {
      console.error("Logout error:", error);
    }

    // Update client state
    AuthStorage.logout();
    loggedInStore.logout();
    isOpen = false;
    navigateWithTransition("/");
  }

  function toggleDropdown() {
    isOpen = !isOpen;
  }

  function closeDropdown() {
    isOpen = false;
  }
</script>

<div class="relative" bind:this={dropdownRef}>
  <button
    on:click={toggleDropdown}
    class="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
    aria-expanded={isOpen}
    aria-haspopup="true"
  >
    <ProfileAvatar
      username={user.username}
      profileImageUrl={user.profileImageUrl}
      size="md"
      linkToProfile={false}
    />
  </button>

  {#if isOpen}
    <div class="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
      <!-- User Info Section -->
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center space-x-3">
          <ProfileAvatar
            username={user.username}
            profileImageUrl={user.profileImageUrl}
            size="md"
            linkToProfile={false}
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {user.username}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400 truncate">
              {user.firstname} {user.lastname}
            </p>
            {#if user.email}
              <p class="text-xs text-gray-500 dark:text-gray-500 truncate">
                {user.email}
              </p>
            {/if}
          </div>
        </div>
      </div>

      <!-- Menu Items -->
      <div class="py-1">
        <a
          href="/profile"
          on:click={closeDropdown}
          class="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          View Profile
        </a>

        <a
          href="/profile/anime"
          on:click={closeDropdown}
          class="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          Watch List
        </a>

        <a
          href="/profile/settings"
          on:click={closeDropdown}
          class="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </a>
      </div>

      <!-- Logout Section -->
      <div class="border-t border-gray-200 dark:border-gray-700 py-1">
        <button
          on:click={handleLogout}
          class="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  {/if}
</div>