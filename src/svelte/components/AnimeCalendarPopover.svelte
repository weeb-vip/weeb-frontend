<script lang="ts">
  import { format } from 'date-fns';
  import AnimeCard from './AnimeCard.svelte';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';
  import { navigateWithTransition } from '../../utils/astro-navigation';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';

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
      const isMobile = window.innerWidth < 768;

      console.log('Button rect:', rect);
      console.log('Window scroll:', window.scrollX, window.scrollY);

      // Simple positioning: directly below the button
      let top = rect.bottom + window.scrollY + 8;
      let left = rect.left + window.scrollX;

      console.log('Initial position:', { top, left });

      // On mobile, try to center the popover
      if (isMobile) {
        const panelWidth = Math.min(window.innerWidth - 32, 350);
        left = rect.left + window.scrollX - (panelWidth - rect.width) / 2;

        // Keep it on screen
        const margin = 16;
        if (left < margin) left = margin;
        if (left + panelWidth > window.innerWidth - margin) {
          left = window.innerWidth - panelWidth - margin;
        }
      }

      position = { top, left };
      console.log('Final position:', position);
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
  title="{getAnimeTitle(anime, $preferencesStore.titleLanguage)} (Ep {anime.episodes[0]?.episodeNumber || '?'}){airTimeText ? ` at ${airTimeText}` : ''}"
  class="text-xs text-blue-700 dark:text-blue-300 text-left hover:bg-blue-100 dark:hover:bg-blue-800/50 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded transition-colors duration-300 w-full flex flex-col"
>
  <span class="truncate">
    {getAnimeTitle(anime, $preferencesStore.titleLanguage)} (Ep {anime.episodes[0]?.episodeNumber || "?"})
  </span>
  {#if airTimeText}
    <span class="text-gray-600 dark:text-gray-400 text-xs font-medium">
      {airTimeText}
    </span>
  {/if}
</button>

{#if isOpen}
  <!-- Mobile backdrop for easier closing -->
  {#if typeof window !== 'undefined' && window.innerWidth < 768}
    <div
      class="fixed inset-0 bg-black/20 z-40 md:hidden"
      on:click={closePopover}
    ></div>
  {/if}

  <div
    bind:this={popoverRef}
    class="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 transition-colors duration-300
           max-h-[70vh] overflow-y-auto"
    style="top: {position.top}px; left: {position.left}px; width: {typeof window !== 'undefined' && window.innerWidth < 768 ? Math.min(window.innerWidth - 32, 350) : 420}px;"
  >
    <AnimeCard
      style="episode"
      forceListLayout={true}
      id={anime.id}
      title={getAnimeTitle(anime, $preferencesStore.titleLanguage)}
      description={anime.description || ""}
      tags={anime.tags || []}
      episodes={anime.episodeCount || 0}
      episodeLength={anime.duration ? anime.duration.replace(/per.+?$/, "") : "?"}
      image={GetImageFromAnime(anime)}
      className="hover:cursor-pointer"
      onClick={navigateToShow}
      year={getYearUTC(anime.startDate)}
      airdate={anime.episodeAirTime ? format(anime.episodeAirTime, "EEE MMM do 'at' h:mm a") : anime.episodes[0]?.airDate ? format(new Date(anime.episodes[0].airDate), "EEE MMM do") : "Unknown"}
      episodeTitle={anime.episodes[0]?.titleEn || anime.episodes[0]?.titleJp || "Unknown"}
      episodeNumber={anime.episodes[0]?.episodeNumber?.toString() || "Unknown"}
    />
  </div>
{/if}