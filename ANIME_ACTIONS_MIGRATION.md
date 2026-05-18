# Anime Actions Centralization

## Problem
Anime add/remove actions were scattered across multiple components, causing maintenance issues where fixes in one place would break functionality in another.

## Solution
Created a centralized `AnimeActions` component and `useAnimeActions` composable to consolidate all anime action logic.

## Usage

### 1. Using the AnimeActions Component (Recommended)

Replace scattered button/dropdown implementations with the centralized component:

```svelte
<!-- Before: Scattered implementation -->
{#if !anime.userAnime}
  <Button
    color="blue"
    label="Add to list"
    status={animeStatuses[anime.id] || 'idle'}
    onClick={() => handleAddAnime(anime.id)}
  />
{:else}
  <AnimeStatusDropdown
    entry={{...anime.userAnime, anime}}
    on:statusChange={handleStatusChange}
    on:delete={handleDelete}
  />
{/if}

<!-- After: Centralized component -->
<AnimeActions
  {anime}
  variant="button"
  statusKey={anime.id}
/>
```

#### Variants Available:
- `button` - Default button style
- `icon` - Small circular icon button
- `hero` - Large hero banner style
- `compact` - Small compact button

### 2. Using the useAnimeActions Composable

For custom implementations that need more control:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { useAnimeActions } from '../composables/useAnimeActions';

  const {
    statusStore,
    getAddMutation,
    updateStatus,
    clearStatusAfterDelay
  } = useAnimeActions();

  let addMutationStore: any = null;

  onMount(() => {
    const addMutation = getAddMutation();
    addMutation.subscribe((value: any) => {
      addMutationStore = value;
    });
  });

  function handleAddAnime(animeId: string) {
    const statusKey = `custom-${animeId}`;
    updateStatus(statusKey, 'loading');

    addMutationStore.mutate(
      { input: { animeID: animeId, status: 'PLANTOWATCH' } },
      {
        onSuccess: () => {
          updateStatus(statusKey, 'success');
          clearStatusAfterDelay(statusKey);
        },
        onError: () => {
          updateStatus(statusKey, 'error');
          clearStatusAfterDelay(statusKey, 2000);
        }
      }
    );
  }

  $: currentStatus = $statusStore[`custom-${anime.id}`] || 'idle';
</script>

<button
  on:click={() => handleAddAnime(anime.id)}
  disabled={currentStatus === 'loading'}
>
  {currentStatus === 'loading' ? 'Adding...' : 'Add to List'}
</button>
```

## Migration Steps

1. **Replace component usage:**
   ```svelte
   <!-- Replace this -->
   <HeroBanner
     anime={bannerAnime}
     onAddAnime={handleAddAnime}
     animeStatus={animeStatus}
     onDeleteAnime={handleDelete}
   />

   <!-- With this -->
   <HeroBanner anime={bannerAnime} />
   ```

2. **Remove old event handlers:**
   - Delete `handleAddAnime`, `handleStatusChange`, `handleDelete` functions
   - Remove `useAddAnimeWithToast` and `useDeleteAnimeWithToast` imports
   - Remove local status tracking variables

3. **Update props:**
   - Remove `onAddAnime`, `animeStatus`, `onDeleteAnime` props from components

## Benefits

- ✅ **Single source of truth** for anime actions
- ✅ **Consistent behavior** across all components
- ✅ **Automatic status tracking** with loading states
- ✅ **Built-in error handling** with toast notifications
- ✅ **Easy to maintain** and update
- ✅ **Type safe** with TypeScript
- ✅ **Flexible variants** for different UI needs

## Components Updated

- ✅ `HeroBanner.svelte` - Simplified to use AnimeActions
- 🔄 `HomepageSSR.svelte` - Ready for migration
- 🔄 `ShowContent.svelte` - Ready for migration
- 🔄 `CurrentlyAiringCard.svelte` - Ready for migration
- 🔄 `ProfilePage.svelte` - Ready for migration

Continue migrating other components by replacing their anime action implementations with `<AnimeActions>` component usage.