<script lang="ts">
  import { untrack } from 'svelte';
  import ProfileDropdown from './ProfileDropdown.svelte';
  import ProfileAvatar from './ProfileAvatar.svelte';
  import Button from './Button.svelte';
  import { UserProfileWrapperBloc } from './UserProfileWrapper.bloc.svelte';

  let {
    isMobile = false,
    onProfileClick = null,
    bloc: injected = undefined
  }: {
    isMobile?: boolean;
    onProfileClick?: (() => void) | null;
    bloc?: UserProfileWrapperBloc;
  } = $props();

  // Built here, in the init body, and not as a prop default: the real bloc
  // calls createQuery, and the QueryClient is only reachable from Svelte
  // context during component initialisation.
  const bloc = untrack(() => injected) ?? new UserProfileWrapperBloc();

  function handleMobileProfileClick() {
    bloc.openDrawer();
    onProfileClick?.();
  }
</script>

{#if bloc.status === 'loading'}
  <!-- Loading skeleton -->
  <div class="flex items-center space-x-2">
    <div class="w-10 h-10 bg-weeb-surface rounded-full animate-pulse"></div>
    {#if !isMobile}
      <div class="w-16 h-4 bg-weeb-surface rounded animate-pulse"></div>
    {/if}
  </div>
{:else if bloc.status === 'ready'}
  {#if isMobile}
    <!-- Mobile: Just avatar that opens menu -->
    <button class="p-2" aria-label="Open menu" onclick={handleMobileProfileClick}>
      <ProfileAvatar
        username={bloc.displayUser?.username ?? ''}
        profileImageUrl={bloc.displayUser?.profileImageUrl}
        size="sm"
        linkToProfile={false}
        className="!cursor-pointer"
      />
    </button>
  {:else}
    <!-- Desktop: Profile dropdown -->
    <ProfileDropdown user={bloc.displayUser!} />
  {/if}
{:else if bloc.status === 'stuck'}
  <!-- Logged in, the query has settled, and there is still no user. The
       skeleton does not pulse here: it is not loading, and animating it told
       users to keep waiting for something that was never going to arrive. -->
  <div class="flex items-center space-x-2">
    <div class="w-10 h-10 bg-weeb-surface rounded-full"></div>
    {#if !isMobile}
      <div class="w-16 h-4 bg-weeb-surface rounded"></div>
    {/if}
  </div>
{:else if isMobile}
  <!-- Signed out, mobile: hamburger menu button -->
  <button class="p-4" aria-label="Open menu" onclick={handleMobileProfileClick}>
    <svg class="w-6 h-6 text-weeb-fg-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
    </svg>
  </button>
{:else}
  <!-- Signed out, desktop: Login/Register buttons -->
  <div class="flex items-center space-x-3">
    <Button color="blue" label="Login" onClick={() => bloc.requestLogin()} />
    <Button color="transparent" label="Register" onClick={() => bloc.requestRegister()} />
  </div>
{/if}
