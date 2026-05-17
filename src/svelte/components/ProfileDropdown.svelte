<script lang="ts">
  import { onMount } from 'svelte';
  import ProfileAvatar from './ProfileAvatar.svelte';
  import ProfileMenuContent from './ProfileMenuContent.svelte';

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
    class="flex items-center space-x-2 p-1 rounded-full hover:bg-weeb-surface hover:bg-weeb-surface transition-colors duration-200"
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
    <div class="absolute right-0 mt-2 w-72 bg-weeb-surface rounded-lg shadow-lg border border-weeb-border py-2 z-50">
      <ProfileMenuContent {user} isMobile={false} onClose={closeDropdown} />
    </div>
  {/if}
</div>