<script lang="ts">
  import { onMount } from 'svelte';
  import Button from './Button.svelte';
  import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
  import { useAddAnimeWithToast, useDeleteAnimeWithToast } from '../utils/anime-actions';

  // Props
  export let anime: any;
  export let variant: 'default' | 'icon-only' | 'hero' | 'compact' = 'default';
  export let className: string = '';
  export let showLabel: boolean = true;

  // Use mutations from anime-actions.ts
  let addMutation: any;
  let deleteMutation: any;

  // Computed values
  let currentStatus: 'idle' | 'loading' | 'success' | 'error' = 'idle';

  onMount(() => {
    // Initialize mutations
    addMutation = useAddAnimeWithToast();
    deleteMutation = useDeleteAnimeWithToast();
  });

  // Update status based on mutation state
  $: currentStatus = ($addMutation?.isPending || $deleteMutation?.isPending) ? 'loading' : 'idle';

  // Action handlers
  function handleAddAnime() {
    if (!anime?.id || !$addMutation) {
      console.log('❌ Early return - missing anime ID or mutation');
      return;
    }

    $addMutation.mutate({ input: { animeID: anime.id, status: 'PLANTOWATCH' } });
  }

  function onStatusChange(event: CustomEvent) {
    const { animeId, status } = event.detail;

    if (!$addMutation) {
      console.log('❌ Early return - missing add mutation');
      return;
    }

    $addMutation.mutate({ input: { animeID: animeId, status } });
  }

  function onDelete(event: CustomEvent) {
    const animeId = event.detail?.animeId;

    if (!animeId || !$deleteMutation) {
      console.log('❌ Early return - missing anime ID or delete mutation');
      return;
    }

    $deleteMutation.mutate(animeId);
  }

  // Computed values
  $: hasUserAnime = anime?.userAnime;
</script>

{#if hasUserAnime}
  <!-- Show status dropdown for anime already in list -->
  <AnimeStatusDropdown
    entry={{
      ...anime.userAnime,
      anime: anime, // Pass the anime ID for deletion (backend expects this)
    }}
    {variant}
    on:statusChange={onStatusChange}
    on:delete={onDelete}
  />
{:else}
  <!-- Show add button for anime not in list -->
  {#if variant === 'icon-only'}
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
