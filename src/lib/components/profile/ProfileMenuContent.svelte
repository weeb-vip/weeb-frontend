<script lang="ts">
  import { untrack } from 'svelte';
  import ProfileAvatar from './ProfileAvatar.svelte';
  import { ProfileMenuContentBloc } from './ProfileMenuContent.bloc.svelte';

  let {
    user,
    isMobile = false,
    onClose = null,
    bloc: injected = undefined
  }: {
    user: {
      id: string;
      username: string;
      firstname: string;
      lastname: string;
      email?: string | null;
      profileImageUrl?: string | null;
    };
    isMobile?: boolean;
    /** The surface that hosts this menu, closing itself. */
    onClose?: (() => void) | null;
    bloc?: ProfileMenuContentBloc;
  } = $props();

  // Read at init rather than as a reactive default: the real bloc reaches the
  // auth store and the logout mutation, and neither wants re-creating on a
  // prop change.
  const bloc = untrack(() => injected) ?? new ProfileMenuContentBloc();

  // Different styling based on context
  const userSectionClass = $derived(isMobile
    ? "flex items-center px-4 py-4 space-x-3 hover:bg-weeb-surface-hover/50 transition-colors duration-300"
    : "px-4 py-3 border-b border-weeb-border");

  const menuItemClass = $derived(isMobile
    ? "flex items-center px-4 py-3 hover:bg-weeb-surface-hover/50 transition-colors duration-300"
    : "flex items-center px-4 py-2 text-sm text-weeb-fg-secondary hover:bg-weeb-surface-hover transition-colors");

  const logoutButtonClass = $derived(isMobile
    ? "w-full text-left px-4 py-3 text-sm text-weeb-red hover:bg-weeb-surface-hover/50 transition-colors duration-300"
    : "flex items-center w-full px-4 py-2 text-sm text-weeb-red hover:bg-weeb-surface-hover transition-colors");

  function handleLogout() {
    bloc.signOut(() => onClose?.());
  }

  function handleLinkClick() {
    onClose?.();
  }
</script>

<!-- User Info Section -->
{#if isMobile}
  <a
    href="/profile"
    onclick={handleLinkClick}
    class={userSectionClass}
  >
    <ProfileAvatar
      username={user.username}
      profileImageUrl={user.profileImageUrl}
      size="md"
      linkToProfile={false}
    />
    <div class="flex-1">
      <p class="font-semibold text-weeb-fg transition-colors duration-300">{user.username}</p>
      <p class="text-sm text-weeb-fg-muted transition-colors duration-300">{user.firstname} {user.lastname}</p>
    </div>
  </a>
{:else}
  <div class={userSectionClass}>
    <div class="flex items-center space-x-3">
      <ProfileAvatar
        username={user.username}
        profileImageUrl={user.profileImageUrl}
        size="md"
        linkToProfile={false}
      />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-weeb-fg truncate">
          {user.username}
        </p>
        <p class="text-sm text-weeb-fg-muted truncate">
          {user.firstname} {user.lastname}
        </p>
        {#if user.email}
          <p class="text-xs text-weeb-fg-muted truncate">
            {user.email}
          </p>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Menu Items -->
<div class={isMobile ? "border-t border-weeb-border transition-colors duration-300" : "py-1"}>
  <a
    href="/profile"
    onclick={handleLinkClick}
    class={menuItemClass}
  >
    {#if isMobile}
      <i class="fas fa-user w-5 text-center mr-3 text-weeb-fg-muted"></i>
    {:else}
      <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    {/if}
    <span class={isMobile ? "text-weeb-fg-secondary" : ""}>View Profile</span>
  </a>

  <a
    href="/profile/anime"
    onclick={handleLinkClick}
    class={menuItemClass}
  >
    {#if isMobile}
      <i class="fas fa-bookmark w-5 text-center mr-3 text-weeb-fg-muted"></i>
    {:else}
      <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    {/if}
    <!-- Matches the drawer and the page's own title. "Watchlist" named half of
         what this page holds; you do not watch a manga. -->
    <span class={isMobile ? "text-weeb-fg-secondary" : ""}>My List</span>
  </a>

  <a
    href="/settings"
    onclick={handleLinkClick}
    class={menuItemClass}
  >
    {#if isMobile}
      <i class="fas fa-cog w-5 text-center mr-3 text-weeb-fg-muted"></i>
    {:else}
      <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    {/if}
    <span class={isMobile ? "text-weeb-fg-secondary" : ""}>Settings</span>
  </a>
</div>

<!-- Logout Section -->
<div class={isMobile ? "border-t border-weeb-border transition-colors duration-300" : "border-t border-weeb-border py-1"}>
  <button
    onclick={handleLogout}
    class={logoutButtonClass}
    disabled={bloc.isSigningOut}
  >
    {#if !isMobile}
      <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    {/if}
    {bloc.isSigningOut ? 'Signing out…' : 'Sign Out'}
  </button>
</div>
