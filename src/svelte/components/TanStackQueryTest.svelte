<script lang="ts">
  import { useUser, useHomePageData, useCurrentlyAiring } from '../services/queries';

  // Test user query
  const userQuery = useUser();

  // Test data queries
  const homePageQuery = useHomePageData();
  const currentlyAiringQuery = useCurrentlyAiring();
</script>

<div class="space-y-6">
  <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
    <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">User Query Test</h2>

    {#if $userQuery.isPending}
      <div class="animate-pulse">
        <div class="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
        <div class="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
      </div>
    {:else if $userQuery.isError}
      <div class="text-red-600 dark:text-red-400">
        Error: {$userQuery.error?.message || 'User query failed'}
      </div>
    {:else if $userQuery.data}
      <div class="text-green-600 dark:text-green-400">
        ✅ User loaded: {$userQuery.data.email}
        {#if $userQuery.data.first_name}
          ({$userQuery.data.first_name} {$userQuery.data.last_name})
        {/if}
      </div>
    {:else}
      <div class="text-gray-600 dark:text-gray-400">No user data (not logged in)</div>
    {/if}
  </div>

  <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
    <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Home Page Data Query Test</h2>

    {#if $homePageQuery.isPending}
      <div class="animate-pulse">
        <div class="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
        <div class="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
      </div>
    {:else if $homePageQuery.isError}
      <div class="text-red-600 dark:text-red-400">
        Error: {$homePageQuery.error?.message || 'Home page query failed'}
      </div>
    {:else if $homePageQuery.data}
      <div class="text-green-600 dark:text-green-400">
        ✅ Home page data loaded successfully
        <div class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Data keys: {Object.keys($homePageQuery.data).join(', ')}
        </div>
      </div>
    {:else}
      <div class="text-gray-600 dark:text-gray-400">No data</div>
    {/if}
  </div>

  <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
    <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Currently Airing Query Test</h2>

    {#if $currentlyAiringQuery.isPending}
      <div class="animate-pulse">
        <div class="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
        <div class="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
      </div>
    {:else if $currentlyAiringQuery.isError}
      <div class="text-red-600 dark:text-red-400">
        Error: {$currentlyAiringQuery.error?.message || 'Currently airing query failed'}
      </div>
    {:else if $currentlyAiringQuery.data}
      <div class="text-green-600 dark:text-green-400">
        ✅ Currently airing data loaded successfully
        <div class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Data keys: {Object.keys($currentlyAiringQuery.data).join(', ')}
        </div>
      </div>
    {:else}
      <div class="text-gray-600 dark:text-gray-400">No data</div>
    {/if}
  </div>

  <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
    <p class="text-sm text-blue-800 dark:text-blue-200">
      <strong>Note:</strong> This test demonstrates TanStack Query working with SSR.
      The queries should work both during server-side rendering and client-side hydration.
    </p>
  </div>
</div>