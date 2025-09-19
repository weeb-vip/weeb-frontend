<script lang="ts">
  import { onMount } from 'svelte';

  let AutocompleteAdvanced: any = null;
  let mounted = false;

  onMount(async () => {
    // Dynamically import the component to avoid SSR issues
    const module = await import('./AutocompleteAdvanced.svelte');
    AutocompleteAdvanced = module.default;
    mounted = true;
  });
</script>

{#if mounted && AutocompleteAdvanced}
  <svelte:component this={AutocompleteAdvanced} />
{:else}
  <!-- SSR fallback - simple search input placeholder -->
  <div class="relative">
    <input
      type="text"
      placeholder="Search anime..."
      class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-colors duration-300"
      readonly
    />
    <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
      <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
    </div>
  </div>
{/if}