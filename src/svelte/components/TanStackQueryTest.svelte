<script lang="ts">
  import { useUser, useHomePageData, useCurrentlyAiring } from '../services/queries';

  // Test user query
  const userQuery = useUser();

  // Test data queries
  const homePageQuery = useHomePageData();
  const currentlyAiringQuery = useCurrentlyAiring();
</script>

<div class="space-y-6">
  <div class="bg-weeb-surface p-6 rounded-lg shadow">
    <h2 class="text-xl font-semibold mb-4 text-weeb-fg">User Query Test</h2>

    {#if $userQuery.isPending}
      <div class="animate-pulse">
        <div class="h-4 bg-weeb-surface rounded w-3/4 mb-2"></div>
        <div class="h-3 bg-weeb-surface rounded w-1/2"></div>
      </div>
    {:else if $userQuery.isError}
      <div class="text-weeb-red">
        Error: {$userQuery.error?.message || 'User query failed'}
      </div>
    {:else if $userQuery.data}
      <div class="text-weeb-green">
        ✅ User loaded: {$userQuery.data.email}
        {#if $userQuery.data.first_name}
          ({$userQuery.data.first_name} {$userQuery.data.last_name})
        {/if}
      </div>
    {:else}
      <div class="text-weeb-fg-muted">No user data (not logged in)</div>
    {/if}
  </div>

  <div class="bg-weeb-surface p-6 rounded-lg shadow">
    <h2 class="text-xl font-semibold mb-4 text-weeb-fg">Home Page Data Query Test</h2>

    {#if $homePageQuery.isPending}
      <div class="animate-pulse">
        <div class="h-4 bg-weeb-surface rounded w-3/4 mb-2"></div>
        <div class="h-3 bg-weeb-surface rounded w-1/2"></div>
      </div>
    {:else if $homePageQuery.isError}
      <div class="text-weeb-red">
        Error: {$homePageQuery.error?.message || 'Home page query failed'}
      </div>
    {:else if $homePageQuery.data}
      <div class="text-weeb-green">
        ✅ Home page data loaded successfully
        <div class="mt-2 text-sm text-weeb-fg-muted">
          Data keys: {Object.keys($homePageQuery.data).join(', ')}
        </div>
      </div>
    {:else}
      <div class="text-weeb-fg-muted">No data</div>
    {/if}
  </div>

  <div class="bg-weeb-surface p-6 rounded-lg shadow">
    <h2 class="text-xl font-semibold mb-4 text-weeb-fg">Currently Airing Query Test</h2>

    {#if $currentlyAiringQuery.isPending}
      <div class="animate-pulse">
        <div class="h-4 bg-weeb-surface rounded w-3/4 mb-2"></div>
        <div class="h-3 bg-weeb-surface rounded w-1/2"></div>
      </div>
    {:else if $currentlyAiringQuery.isError}
      <div class="text-weeb-red">
        Error: {$currentlyAiringQuery.error?.message || 'Currently airing query failed'}
      </div>
    {:else if $currentlyAiringQuery.data}
      <div class="text-weeb-green">
        ✅ Currently airing data loaded successfully
        <div class="mt-2 text-sm text-weeb-fg-muted">
          Data keys: {Object.keys($currentlyAiringQuery.data).join(', ')}
        </div>
      </div>
    {:else}
      <div class="text-weeb-fg-muted">No data</div>
    {/if}
  </div>

  <div class="bg-weeb-surface p-4 rounded-lg border border-weeb-border">
    <p class="text-sm text-weeb-accent">
      <strong>Note:</strong> This test demonstrates TanStack Query working with SSR.
      The queries should work both during server-side rendering and client-side hydration.
    </p>
  </div>
</div>