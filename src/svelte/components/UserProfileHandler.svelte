<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeQueryClient } from '../services/query-client';
  import ConfigProvider from './ConfigProvider.svelte';
  import UserProfileWrapper from './UserProfileWrapper.svelte';

  export let isMobile: boolean = false;
  export let onProfileClick: (() => void) | null = null;

  let QueryClientProvider: any = null;
  let queryClient: any = null;
  let isClient = false;

  onMount(async () => {
    // Initialize TanStack Query
    try {
      const { QueryClientProvider: QCP } = await import('@tanstack/svelte-query');
      QueryClientProvider = QCP;
      queryClient = initializeQueryClient();
      isClient = true;
    } catch (error) {
      console.warn('Failed to load TanStack Query:', error);
      isClient = true;
    }
  });
</script>

<ConfigProvider>
  {#if isClient}
    {#if QueryClientProvider && queryClient}
      <svelte:component this={QueryClientProvider} client={queryClient}>
        <UserProfileWrapper {isMobile} {onProfileClick} />
      </svelte:component>
    {:else}
      <!-- Fallback loading state -->
      <div class="flex items-center space-x-2">
        <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
        {#if !isMobile}
          <div class="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        {/if}
      </div>
    {/if}
  {:else}
    <!-- Show fallback while client is initializing -->
    <div class="flex items-center space-x-2">
      <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
      {#if !isMobile}
        <div class="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      {/if}
    </div>
  {/if}
</ConfigProvider>
