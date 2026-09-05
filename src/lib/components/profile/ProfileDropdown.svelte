<script lang="ts">
  import ProfileAvatar from './ProfileAvatar.svelte';
  import ProfileMenuContent from './ProfileMenuContent.svelte';
  import { ProfileDropdownBloc } from './ProfileDropdown.bloc.svelte';
  import { clickOutside } from '$lib/actions/clickOutside';

  let {
    user,
    bloc = new ProfileDropdownBloc()
  }: {
    user: {
      id: string;
      username: string;
      firstname: string;
      lastname: string;
      email?: string | null;
      profileImageUrl?: string | null;
    };
    bloc?: ProfileDropdownBloc;
  } = $props();
</script>

<!-- Was an onMount that added a document mousedown listener and compared
     contains() by hand. `clickOutside` is that listener, attached only while
     the menu is open and always removed on destroy. -->
<div
  class="relative"
  use:clickOutside={{ handler: () => bloc.close(), enabled: bloc.isOpen, event: 'mousedown' }}
>
  <button
    onclick={() => bloc.toggle()}
    class="flex items-center space-x-2 p-1 rounded-full hover:bg-weeb-surface hover:bg-weeb-surface transition-colors duration-200"
    aria-expanded={bloc.isOpen}
    aria-haspopup="true"
  >
    <ProfileAvatar
      username={user.username}
      profileImageUrl={user.profileImageUrl}
      size="md"
      linkToProfile={false}
    />
  </button>

  {#if bloc.isOpen}
    <!-- Ground, border, radius and shadow are `.weeb-floating`: the same
         surface the Select and status menus are drawn on. This used to reach
         for Tailwind's own `rounded-lg` and `shadow-lg`, which are neither the
         product's radius nor its shadow. -->
    <div class="profile-menu weeb-floating absolute right-0 mt-2 w-72 py-2">
      <ProfileMenuContent {user} isMobile={false} onClose={() => bloc.close()} />
    </div>
  {/if}
</div>

<style>
  .profile-menu {
    z-index: var(--weeb-z-dropdown);
  }
</style>
