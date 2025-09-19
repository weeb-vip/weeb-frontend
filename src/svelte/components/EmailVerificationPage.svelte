<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeQueryClient } from '../services/query-client';
  import EmailVerification from './EmailVerification.svelte';

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

{#if isClient}
  {#if QueryClientProvider && queryClient}
    <svelte:component this={QueryClientProvider} client={queryClient}>
      <EmailVerification />
    </svelte:component>
  {:else}
    <!-- Loading state -->
    <slot name="fallback">
      <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div class="sm:mx-auto sm:w-full sm:max-w-md">
          <div class="text-center">
            <p class="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    </slot>
  {/if}
{:else}
  <!-- SSR fallback -->
  <slot name="fallback">
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <div class="text-center">
          <p class="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    </div>
  </slot>
{/if}