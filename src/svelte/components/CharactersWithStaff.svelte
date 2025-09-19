<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import SafeImage from './SafeImage.svelte';
  import { getCharactersAndStaffByAnimeID } from '../../services/queries';

  export let animeId: string;

  type FilterType = 'all' | 'main' | 'supporting' | 'minor';

  let filter: FilterType = 'all';
  let expandedCharacters = new Set<string>();

  const charactersQuery = createQuery(getCharactersAndStaffByAnimeID(animeId));

  $: data = $charactersQuery.data;
  $: isLoading = $charactersQuery.isLoading;

  $: filteredData = (() => {
    if (!data) return [];

    // Create a stable sorted copy of the data first
    const stableData = [...data].sort((a, b) => {
      // Sort by character importance first (main > supporting > minor)
      const getRolePriority = (role: string) => {
        const roleStr = role?.toLowerCase() || '';
        if (roleStr.includes('main') || roleStr.includes('protagonist')) return 3;
        if (roleStr.includes('supporting')) return 2;
        return 1;
      };

      const aPriority = getRolePriority(a.character.role || '');
      const bPriority = getRolePriority(b.character.role || '');

      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }

      // Then sort by name for consistent ordering
      return (a.character.name || '').localeCompare(b.character.name || '');
    });

    if (filter === 'all') return stableData;

    return stableData.filter(entry => {
      const role = entry.character.role?.toLowerCase() || '';
      switch (filter) {
        case 'main':
          return role.includes('main') || role.includes('protagonist');
        case 'supporting':
          return role.includes('supporting');
        case 'minor':
          return !role.includes('main') && !role.includes('supporting') && !role.includes('protagonist');
        default:
          return true;
      }
    });
  })();

  function toggleCharacterExpanded(characterName: string) {
    const newSet = new Set(expandedCharacters);
    if (newSet.has(characterName)) {
      newSet.delete(characterName);
    } else {
      newSet.add(characterName);
    }
    expandedCharacters = newSet;
  }

  function getCharacterCardSize(role: string) {
    const roleStr = role?.toLowerCase() || '';
    if (roleStr.includes('main') || roleStr.includes('protagonist')) {
      return 'main'; // Larger cards for main characters
    } else if (roleStr.includes('supporting')) {
      return 'supporting'; // Medium cards
    }
    return 'minor'; // Smaller cards for minor characters
  }

  function getRoleColor(role: string) {
    const roleStr = role?.toLowerCase() || '';
    if (roleStr.includes('main') || roleStr.includes('protagonist')) {
      return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
    } else if (roleStr.includes('supporting')) {
      return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
    }
    return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50';
  }
</script>

{#if isLoading || !data}
  <div class="flex justify-center items-center py-8">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
{:else}
  <div class="space-y-6">
    <!-- Filter Buttons -->
    <div class="flex flex-wrap gap-2">
      {#each [
        { key: 'all', label: 'All Characters' },
        { key: 'main', label: 'Main Characters' },
        { key: 'supporting', label: 'Supporting' },
        { key: 'minor', label: 'Minor Characters' }
      ] as { key, label }}
        <button
          on:click={() => filter = key}
          class="px-3 py-1 rounded-full text-sm font-medium transition-colors {filter === key
            ? 'bg-blue-600 text-white dark:bg-blue-500'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}"
        >
          {label}
        </button>
      {/each}
    </div>

    <!-- Character Grid -->
    <div class="grid gap-4">
      {#each filteredData as entry (entry.character.name || Math.random())}
        {@const characterName = entry.character.name || `character-${Math.random()}`}
        {@const cardSize = getCharacterCardSize(entry.character.role || '')}
        {@const isExpanded = expandedCharacters.has(characterName)}
        {@const roleColor = getRoleColor(entry.character.role || '')}

        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg {cardSize === 'main'
            ? 'border-2 border-blue-200 dark:border-blue-800'
            : cardSize === 'supporting'
            ? 'border border-green-200 dark:border-green-800'
            : 'border border-gray-200 dark:border-gray-700'}"
        >
          <!-- Character Header -->
          <div class="p-4">
            <div class="flex items-start gap-4">
              <!-- Character Image -->
              <div class="flex-shrink-0">
                <SafeImage
                  src="{encodeURIComponent(`${entry.character.name}_${animeId}`)}"
                  path="characters"
                  alt="characters/{entry.character.name}_{animeId}"
                  className="object-cover rounded-lg {cardSize === 'main'
                    ? 'h-32 w-24'
                    : cardSize === 'supporting'
                    ? 'h-28 w-20'
                    : 'h-24 w-16'}"
                />
              </div>

              <!-- Character Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h3 class="font-bold text-gray-900 dark:text-white truncate {cardSize === 'main' ? 'text-xl' : 'text-lg'}">
                      {entry.character.name}
                    </h3>

                    {#if entry.character.role}
                      <span class="inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 {roleColor}">
                        {entry.character.role}
                      </span>
                    {/if}

                    {#if entry.character.title}
                      <p class="text-sm text-gray-600 dark:text-gray-400 italic mt-2">
                        {entry.character.title}
                      </p>
                    {/if}

                    <!-- Voice Actors Summary -->
                    {#if entry.staff && entry.staff.length > 0}
                      <div class="mt-2">
                        <p class="text-sm text-gray-700 dark:text-gray-300">
                          <span class="font-medium">Voice:</span>
                          {#each entry.staff.slice(0, 2) as staff, i}
                            <span>
                              {staff.givenName} {staff.familyName}
                              {#if staff.language}({staff.language}){/if}{#if i < Math.min(entry.staff.length, 2) - 1}, {/if}
                            </span>
                          {/each}
                          {#if entry.staff.length > 2}
                            <span class="text-gray-500 dark:text-gray-400">
                              +{entry.staff.length - 2} more
                            </span>
                          {/if}
                        </p>
                      </div>
                    {/if}
                  </div>

                  <!-- Expand Button -->
                  {#if entry.staff && entry.staff.length > 0}
                    <button
                      on:click={() => toggleCharacterExpanded(characterName)}
                      class="flex-shrink-0 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      aria-label={isExpanded ? 'Show less' : 'Show more'}
                    >
                      <i class="fas fa-chevron-{isExpanded ? 'up' : 'down'} w-4 h-4"></i>
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          </div>

          <!-- Expanded Staff Details -->
          {#if isExpanded && entry.staff && entry.staff.length > 0}
            <div class="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
              <h4 class="font-semibold text-gray-900 dark:text-white mb-3">Voice Actors</h4>
              <div class="grid gap-3 sm:grid-cols-2">
                {#each entry.staff as staffMember, staffIdx}
                  <div class="flex gap-3 p-2 bg-white dark:bg-gray-800 rounded">
                    <SafeImage
                      src="{encodeURIComponent(`${staffMember.givenName}_${staffMember.familyName}`)}"
                      path="staff"
                      alt="{staffMember.givenName} {staffMember.familyName}"
                      className="h-16 w-12 object-cover rounded"
                    />
                    <div class="flex-1 min-w-0">
                      <h5 class="font-medium text-gray-900 dark:text-white text-sm">
                        {staffMember.givenName} {staffMember.familyName}
                      </h5>
                      {#if staffMember.language}
                        <p class="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {staffMember.language}
                        </p>
                      {/if}
                      <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                        {#if staffMember.birthPlace}
                          <p>{staffMember.birthPlace}</p>
                        {/if}
                        {#if staffMember.birthday}
                          <p>Born: {staffMember.birthday}</p>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    {#if filteredData.length === 0}
      <div class="text-center py-8 text-gray-500 dark:text-gray-400">
        No characters found for the selected filter.
      </div>
    {/if}
  </div>
{/if}