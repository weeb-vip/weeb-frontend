<script lang="ts">
  import { format } from 'date-fns';
  import AnimeCard from './AnimeCard.svelte';
  import { GetImageFromAnime } from '../../services/utils';
  import { navigateWithTransition } from '../../utils/astro-navigation';

  export let anime: any;
  export let isOpen: boolean = false;
  export let position: { top: number; left: number } = { top: 0, left: 0 };

  let buttonRef: HTMLButtonElement;
  let popoverRef: HTMLDivElement;

  // Format air time display
  $: airTimeText = anime.episodeAirTime ? format(anime.episodeAirTime, "h:mm a") : null;

  function togglePopover() {
    if (!isOpen && buttonRef) {
      const rect = buttonRef.getBoundingClientRect();
      let left = rect.left + window.scrollX;
      const top = rect.bottom + window.scrollY + 8;
      const panelWidth = 420;
      const screenWidth = window.innerWidth;

      // Clamp left so it doesn't overflow on mobile
      if (left + panelWidth > screenWidth) {
        left = screenWidth - panelWidth - 8; // 8px margin
        if (left < 8) left = 8; // Prevent negative offset
      }

      position = { top, left };
    }
    isOpen = !isOpen;
  }

  function closePopover() {
    isOpen = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (popoverRef && !popoverRef.contains(event.target as Node) &&
        buttonRef && !buttonRef.contains(event.target as Node)) {
      closePopover();
    }
  }

  function navigateToShow() {
    navigateWithTransition(`/show/${anime.id}`);
  }

  $: if (typeof window !== 'undefined') {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
  }
</script>

<svelte:window on:beforeunload={() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('click', handleClickOutside);
  }
}} />

<button
  bind:this={buttonRef}
  on:click={togglePopover}
  title="{anime.titleEn || anime.titleJp || 'Unknown'} (Ep {anime.episodes[0]?.episodeNumber || '?'}){airTimeText ? ` at ${airTimeText}` : ''}"
  class="text-xs text-blue-700 dark:text-blue-300 text-left hover:bg-blue-100 dark:hover:bg-blue-800/50 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded transition-colors duration-300 w-full flex flex-col"
>
  <span class="truncate">
    {anime.titleEn || anime.titleJp || "Unknown"} (Ep {anime.episodes[0]?.episodeNumber || "?"})
  </span>
  {#if airTimeText}
    <span class="text-gray-600 dark:text-gray-400 text-xs font-medium">
      {airTimeText}
    </span>
  {/if}
</button>

{#if isOpen}
  <div
    bind:this={popoverRef}
    class="fixed z-50 w-[420px] max-w-[95vw] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 transition-colors duration-300"
    style="top: {position.top}px; left: {position.left}px;"
  >
    <AnimeCard
      style="episode"
      forceListLayout={true}
      id={anime.id}
      title={anime.titleEn || anime.titleJp || "Unknown"}
      description={anime.description || ""}
      episodes={anime.episodeCount || 0}
      episodeLength={anime.duration ? anime.duration.replace(/per.+?$/, "") : "?"}
      image={GetImageFromAnime(anime)}
      className="hover:cursor-pointer"
      onClick={navigateToShow}
      year={anime.startDate ? new Date(anime.startDate).getFullYear().toString() : "Unknown"}
      airdate={anime.episodeAirTime ? format(anime.episodeAirTime, "EEE MMM do 'at' h:mm a") : anime.episodes[0]?.airDate ? format(new Date(anime.episodes[0].airDate), "EEE MMM do") : "Unknown"}
      episodeTitle={anime.episodes[0]?.titleEn || anime.episodes[0]?.titleJp || "Unknown"}
      episodeNumber={anime.episodes[0]?.episodeNumber?.toString() || "Unknown"}
    />
  </div>
{/if}