<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import SafeImage from './SafeImage.svelte';
  import { getCharactersAndStaffByAnimeID } from '../../services/queries';

  export let animeId: string;
  export let ssrCharactersData: any = null;

  type FilterType = 'all' | 'main' | 'supporting' | 'minor';

  let filter: FilterType = 'all';
  let expandedCharacters = new Set<string>();

  // Create query store (always, but only use if no SSR data)
  const charactersQuery = createQuery(getCharactersAndStaffByAnimeID(animeId));

  // Use SSR data if available, otherwise use client-side query
  $: data = ssrCharactersData ? ssrCharactersData.charactersAndStaffByAnimeId : $charactersQuery.data;
  $: isLoading = ssrCharactersData ? false : $charactersQuery.isLoading;

  // Log which data source is being used
  $: if (ssrCharactersData) {
    console.log('🏃‍♂️ [CharactersWithStaff] Using SSR characters data');
  } else if (!$charactersQuery.isLoading) {
    console.log('🔄 [CharactersWithStaff] Using client-side query data');
  }

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
      return 'text-weeb-accent bg-weeb-surface';
    } else if (roleStr.includes('supporting')) {
      return 'text-weeb-green bg-weeb-green/10';
    }
    return 'text-weeb-fg-muted bg-weeb-bg-elevated/50';
  }
</script>

{#if isLoading || !data}
  <div class="flex justify-center items-center py-8">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-weeb-accent"></div>
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
            ? 'bg-weeb-accent text-white'
            : 'bg-weeb-surface text-weeb-fg-secondary hover:bg-weeb-surface-hover hover:bg-weeb-surface-hover'}"
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
          class="bg-weeb-surface rounded-lg shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg {cardSize === 'main'
            ? 'border-2 border-weeb-border'
            : cardSize === 'supporting'
            ? 'border border-weeb-green'
            : 'border border-weeb-border'}"
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
                    <h3 class="font-bold text-weeb-fg text-weeb-fg truncate {cardSize === 'main' ? 'text-xl' : 'text-lg'}">
                      {entry.character.name}
                    </h3>

                    {#if entry.character.role}
                      <span class="inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 {roleColor}">
                        {entry.character.role}
                      </span>
                    {/if}

                    {#if entry.character.title}
                      <p class="text-sm text-weeb-fg-muted italic mt-2">
                        {entry.character.title}
                      </p>
                    {/if}

                    <!-- Voice Actors Summary -->
                    {#if entry.staff && entry.staff.length > 0}
                      <div class="mt-2">
                        <p class="text-sm text-weeb-fg-secondary">
                          <span class="font-medium">Voice:</span>
                          {#each entry.staff.slice(0, 2) as staff, i}
                            <span>
                              {staff.givenName} {staff.familyName}
                              {#if staff.language}({staff.language}){/if}{#if i < Math.min(entry.staff.length, 2) - 1}, {/if}
                            </span>
                          {/each}
                          {#if entry.staff.length > 2}
                            <span class="text-weeb-fg-muted">
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
                      class="flex-shrink-0 p-2 text-weeb-fg-muted hover:text-weeb-fg-secondary hover:text-weeb-fg transition-colors"
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
            <div class="border-t border-weeb-border bg-weeb-bg-elevated/50 p-4">
              <h4 class="font-semibold text-weeb-fg text-weeb-fg mb-3">Voice Actors</h4>
              <div class="grid gap-3 sm:grid-cols-2">
                {#each entry.staff as staffMember, staffIdx}
                  <div class="flex gap-3 p-2 bg-weeb-surface rounded">
                    <SafeImage
                      src="{encodeURIComponent(`${staffMember.givenName}_${staffMember.familyName}`)}"
                      path="staff"
                      alt="{staffMember.givenName} {staffMember.familyName}"
                      className="h-16 w-12 object-cover rounded"
                    />
                    <div class="flex-1 min-w-0">
                      <h5 class="font-medium text-weeb-fg text-weeb-fg text-sm">
                        {staffMember.givenName} {staffMember.familyName}
                      </h5>
                      {#if staffMember.language}
                        <p class="text-xs text-weeb-accent font-medium">
                          {staffMember.language}
                        </p>
                      {/if}
                      <div class="text-xs text-weeb-fg-muted mt-1 space-y-0.5">
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
      <div class="text-center py-8 text-weeb-fg-muted">
        No characters found for the selected filter.
      </div>
    {/if}
  </div>
{/if}