<script lang="ts">
  import ConfigProvider from './ConfigProvider.svelte';
  import QueryProvider from './QueryProvider.svelte';
  import UserProfileWrapper from './UserProfileWrapper.svelte';

  /**
   * The header's account slot: config context, a query client, and the wrapper
   * that decides which of the four signed-in/out states to render. The
   * skeleton this used to show while a dynamic import resolved is gone --
   * `UserProfileWrapper` already renders exactly that skeleton for its own
   * `loading` status, so the copy here only ever duplicated it.
   */
  let {
    isMobile = false,
    onProfileClick = null,
  }: {
    isMobile?: boolean;
    onProfileClick?: (() => void) | null;
  } = $props();
</script>

<ConfigProvider>
  <QueryProvider>
    <UserProfileWrapper {isMobile} {onProfileClick} />
  </QueryProvider>
</ConfigProvider>
