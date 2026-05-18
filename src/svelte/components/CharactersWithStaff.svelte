<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import SafeImage from './SafeImage.svelte';
  import { getCharactersAndStaffByAnimeID } from '../../services/queries';

  export let animeId: string;
  export let ssrCharactersData: any = null;

  type FilterType = 'all' | 'main' | 'supporting' | 'minor';

  let filter: FilterType = 'all';
  let expandedCharacters = new Set<string>();

  // Create query store only if no SSR data
  const charactersQuery = createQuery({
    ...getCharactersAndStaffByAnimeID(animeId),
    enabled: !ssrCharactersData
  });

  // Use SSR data if available, otherwise use client-side query
  $: data = ssrCharactersData ? ssrCharactersData.charactersAndStaffByAnimeId : $charactersQuery.data;
  $: isLoading = ssrCharactersData ? false : $charactersQuery.isLoading;
  $: isError = ssrCharactersData ? false : $charactersQuery.isError;

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

{#if isLoading}
  <div class="chars-loading">
    <div class="chars-spinner"></div>
  </div>
{:else if isError || !data || data.length === 0}
  <div class="chars-empty">No character data available.</div>
{:else}
  <div class="chars-root">
    <!-- Filter pills -->
    <div class="chars-filters">
      {#each [
        { key: 'all', label: 'All' },
        { key: 'main', label: 'Main' },
        { key: 'supporting', label: 'Supporting' },
        { key: 'minor', label: 'Minor' }
      ] as { key, label }}
        <button
          on:click={() => filter = key}
          class="filter-pill"
          class:active={filter === key}
        >
          {label}
        </button>
      {/each}
    </div>

    <!-- Character Grid -->
    <div class="chars-grid">
      {#each filteredData as entry, idx (entry.character.name || `char-${idx}`)}
        {@const isExpanded = expandedCharacters.has(entry.character.name || '')}
        {@const hasMultipleVAs = entry.staff && entry.staff.length > 1}
        {@const primaryVA = entry.staff?.[0]}
        {@const roleClass = (entry.character.role || '').toLowerCase().includes('main') || (entry.character.role || '').toLowerCase().includes('protagonist') ? 'main' : 'supporting'}

        <div class="char-card" class:expanded={isExpanded}>
          <!-- Main card content -->
          <div class="char-card-main" on:click={() => hasMultipleVAs && toggleCharacterExpanded(entry.character.name || '')}>
            <div class="char-portrait char-portrait-{idx % 8}">
              <SafeImage
                src="{encodeURIComponent(`${entry.character.name}_${animeId}`)}"
                path="characters"
                alt={entry.character.name || ''}
                className="char-portrait-img"
              />
            </div>
            <div class="char-info">
              <div class="char-name">{entry.character.name || 'Unknown'}</div>
              <div class="char-role" class:main={roleClass === 'main'}>
                {entry.character.role || 'Character'}
              </div>
              {#if primaryVA}
                <div class="char-va">
                  {primaryVA.givenName} {primaryVA.familyName}
                  {#if primaryVA.language}
                    <span class="char-va-lang">({primaryVA.language})</span>
                  {/if}
                </div>
              {/if}
              {#if hasMultipleVAs}
                <div class="char-va-more">
                  +{entry.staff.length - 1} more VA{entry.staff.length - 1 > 1 ? 's' : ''}
                  <svg class="expand-icon" class:rotated={isExpanded} width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M2.5 4L5 6.5L7.5 4"/>
                  </svg>
                </div>
              {/if}
            </div>
          </div>

          <!-- Expanded VA list -->
          {#if isExpanded && entry.staff && entry.staff.length > 1}
            <div class="char-va-list">
              {#each entry.staff as va, vaIdx}
                <div class="va-chip" class:active={vaIdx === 0}>
                  <span class="va-name">{va.givenName} {va.familyName}</span>
                  {#if va.language}
                    <span class="va-lang">{va.language}</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    {#if filteredData.length === 0}
      <div class="chars-empty">No characters found for this filter.</div>
    {/if}
  </div>
{/if}

<style>
  .chars-loading {
    display: flex;
    justify-content: center;
    padding: 32px 0;
  }
  .chars-spinner {
    width: 32px;
    height: 32px;
    border: 2px solid var(--weeb-border);
    border-top-color: var(--weeb-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .chars-root {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .chars-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .filter-pill {
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid var(--weeb-border);
    background: transparent;
    color: var(--weeb-fg-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .filter-pill:hover {
    border-color: var(--weeb-accent);
    color: var(--weeb-fg);
  }
  .filter-pill.active {
    background: var(--weeb-accent);
    border-color: var(--weeb-accent);
    color: white;
  }

  .chars-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .char-card {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    background: var(--weeb-bg-elevated);
    transition: border-color 0.15s, background 0.15s;
    overflow: hidden;
  }
  .char-card:hover {
    border-color: var(--weeb-accent);
    background: var(--weeb-surface);
  }

  .char-card-main {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    cursor: default;
  }
  .char-card-main:has(+ .char-va-list),
  .char-card:not(.expanded) .char-card-main {
    cursor: pointer;
  }

  .char-portrait {
    width: 48px;
    height: 48px;
    border-radius: var(--weeb-radius, 8px);
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
  }
  :global(.char-portrait-img) {
    width: 48px !important;
    height: 48px !important;
    object-fit: cover;
    border-radius: var(--weeb-radius, 8px);
  }
  .char-portrait-0 { background: linear-gradient(135deg, oklch(28% 0.06 280), oklch(18% 0.04 300)); }
  .char-portrait-1 { background: linear-gradient(135deg, oklch(32% 0.08 260), oklch(20% 0.05 280)); }
  .char-portrait-2 { background: linear-gradient(135deg, oklch(26% 0.07 290), oklch(16% 0.04 270)); }
  .char-portrait-3 { background: linear-gradient(135deg, oklch(30% 0.09 270), oklch(18% 0.05 295)); }
  .char-portrait-4 { background: linear-gradient(135deg, oklch(34% 0.10 275), oklch(22% 0.07 300)); }
  .char-portrait-5 { background: linear-gradient(135deg, oklch(24% 0.06 285), oklch(14% 0.03 265)); }
  .char-portrait-6 { background: linear-gradient(135deg, oklch(28% 0.08 300), oklch(18% 0.05 280)); }
  .char-portrait-7 { background: linear-gradient(135deg, oklch(32% 0.07 265), oklch(20% 0.04 290)); }

  .char-info {
    min-width: 0;
    flex: 1;
  }

  .char-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--weeb-fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .char-role {
    font-family: var(--weeb-font-mono);
    font-size: 10px;
    color: var(--weeb-violet);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-top: 2px;
  }
  .char-role.main {
    color: var(--weeb-accent);
  }

  .char-va {
    font-size: 12px;
    color: var(--weeb-fg-muted);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .char-va-lang {
    font-size: 10px;
    opacity: 0.7;
  }

  .char-va-more {
    font-size: 11px;
    color: var(--weeb-accent);
    margin-top: 3px;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }
  .expand-icon {
    transition: transform 0.2s;
  }
  .expand-icon.rotated {
    transform: rotate(180deg);
  }

  /* Expanded VA list */
  .char-va-list {
    border-top: 1px solid var(--weeb-border);
    padding: 10px 14px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    background: oklch(16% 0.012 275);
  }

  .va-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--weeb-border);
    font-size: 11px;
    transition: all 0.15s;
  }
  .va-chip.active {
    border-color: var(--weeb-accent);
    background: oklch(22% 0.03 280);
  }
  .va-name {
    color: var(--weeb-fg-secondary);
    font-weight: 500;
  }
  .va-lang {
    font-family: var(--weeb-font-mono);
    font-size: 9px;
    color: var(--weeb-fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .chars-empty {
    text-align: center;
    padding: 32px 0;
    color: var(--weeb-fg-muted);
    font-size: 14px;
  }

  /* Responsive */
  @media (max-width: 1200px) {
    .chars-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (max-width: 768px) {
    .chars-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .char-card-main {
      padding: 10px;
      gap: 10px;
    }
    .char-portrait {
      width: 40px;
      height: 40px;
    }
    :global(.char-portrait-img) {
      width: 40px !important;
      height: 40px !important;
    }
    .char-name {
      font-size: 12px;
    }
    .char-va {
      font-size: 11px;
    }
  }
  @media (max-width: 480px) {
    .chars-grid {
      grid-template-columns: 1fr;
    }
  }
</style>