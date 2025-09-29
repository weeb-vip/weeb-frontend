<script lang="ts">
  import { onMount } from 'svelte';
  import Button from './Button.svelte';
  import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
  import { useAnimeActions } from '../composables/useAnimeActions';

  // Props
  export let anime: any;
  export let variant: 'button' | 'icon' | 'hero' | 'compact' = 'button';
  export let statusKey: string = ''; // For tracking loading states (optional)
  export let className: string = '';
  export let showLabel: boolean = true;

  // Use centralized anime actions
  const {
    statusStore,
    getAddMutation,
    getDeleteMutation,
    updateStatus,
    clearStatusAfterDelay
  } = useAnimeActions();

  let addMutationStore: any = null;
  let deleteMutationStore: any = null;

  onMount(() => {
    // Subscribe to mutation stores
    const addMutation = getAddMutation();
    const deleteMutation = getDeleteMutation();

    addMutation.subscribe((value: any) => {
      addMutationStore = value;
    });

    deleteMutation.subscribe((value: any) => {
      deleteMutationStore = value;
    });
  });

  // Action handlers
  function handleAddAnime() {
    if (!anime?.id || !addMutationStore) {
      console.log('❌ Early return - missing anime ID or mutation store');
      return;
    }

    if (statusKey) {
      updateStatus(statusKey, 'loading');
    }

    addMutationStore.mutate(
      {
        input: {
          animeID: anime.id,
          status: 'PLANTOWATCH'
        }
      },
      {
        onSuccess: () => {
          if (statusKey) {
            updateStatus(statusKey, 'success');
            clearStatusAfterDelay(statusKey);
          }
        },
        onError: (error: any) => {
          console.error('❌ Add anime failed:', error);
          if (statusKey) {
            updateStatus(statusKey, 'error');
            clearStatusAfterDelay(statusKey, 2000);
          }
        }
      }
    );
  }

  function onStatusChange(event: CustomEvent) {
    const { animeId, status } = event.detail;

    if (!addMutationStore) {
      console.log('❌ Early return - missing add mutation store');
      return;
    }

    if (statusKey) {
      updateStatus(statusKey, 'loading');
    }

    addMutationStore.mutate(
      {
        input: {
          animeID: animeId,
          status
        }
      },
      {
        onSuccess: () => {
          if (statusKey) {
            updateStatus(statusKey, 'success');
            clearStatusAfterDelay(statusKey);
          }
        },
        onError: (error: any) => {
          console.error('❌ Status change failed:', error);
          if (statusKey) {
            updateStatus(statusKey, 'error');
            clearStatusAfterDelay(statusKey, 2000);
          }
        }
      }
    );
  }

  function onDelete(event: CustomEvent) {
    const animeId = event.detail?.animeId;

    if (!animeId || !deleteMutationStore) {
      console.log('❌ Early return - missing anime ID or delete mutation store');
      return;
    }

    if (statusKey) {
      updateStatus(statusKey, 'loading');
    }

    deleteMutationStore.mutate(animeId, {
      onSuccess: () => {
        if (statusKey) {
          updateStatus(statusKey, 'success');
          clearStatusAfterDelay(statusKey);
        }
      },
      onError: (error: any) => {
        console.error('❌ Delete anime failed:', error);
        if (statusKey) {
          updateStatus(statusKey, 'error');
          clearStatusAfterDelay(statusKey, 2000);
        }
      }
    });
  }

  // Computed values
  $: currentStatus = statusKey ? ($statusStore[statusKey] || 'idle') : 'idle';
  $: hasUserAnime = anime?.userAnime;
</script>

{#if hasUserAnime}
  <!-- Show status dropdown for anime already in list -->
  <AnimeStatusDropdown
    entry={{
      ...anime.userAnime,
      anime
    }}
    {variant}
    on:statusChange={onStatusChange}
    on:delete={onDelete}
  />
{:else}
  <!-- Show add button for anime not in list -->
  {#if variant === 'icon'}
    <Button
      color="blue"
      icon='<i class="fas fa-plus w-3 h-3" style="display: flex; align-items: center; justify-content: center; line-height: 1;"></i>'
      showLabel={false}
      status={currentStatus}
      onClick={handleAddAnime}
      className="w-8 h-8 rounded-full flex items-center justify-center p-0 {className}"
    />
  {:else if variant === 'hero'}
    <Button
      color="transparent"
      label="Add to List"
      showLabel={true}
      status={currentStatus}
      onClick={handleAddAnime}
      className="px-4 py-2 text-base font-semibold text-white hover:bg-white hover:text-black focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transition {className}"
    />
  {:else if variant === 'compact'}
    <Button
      color="blue"
      label="Add to list"
      showLabel={showLabel}
      status={currentStatus}
      className="w-fit px-2 py-1 text-xs {className}"
      onClick={handleAddAnime}
    />
  {:else}
    <!-- Default button variant -->
    <Button
      color="blue"
      label="Add to list"
      showLabel={showLabel}
      status={currentStatus}
      className={className}
      onClick={handleAddAnime}
    />
  {/if}
{/if}