<script lang="ts">
  import { onMount } from 'svelte';
  import SafeImage from './SafeImage.svelte';
  import ScrollingText from './ScrollingText.svelte';
  import ScrollingTags from './ScrollingTags.svelte';
  import { analytics } from '../../utils/analytics';

  export let style: 'default' | 'hover-transparent' | 'hover' | 'transparent' | 'long' | 'detail' | 'episode' = 'default';
  export let forceListLayout: boolean = false;
  export let title: string;
  export let description: string;
  export let episodes: number | string;
  export let episodeLength: string;
  export let year: string;
  export let image: string;
  export let id: string | null | undefined;
  export let className: string = '';
  export let airTime: {
    show: boolean;
    text: string;
    variant?: 'countdown' | 'scheduled' | 'aired' | 'airing';
  } | undefined = undefined;
  export let entry: { status?: string } | null = null;

  // Episode specific props
  export let airdate: string = '';
  export let episodeTitle: string = '';
  export let episodeNumber: string = '';

  // Tags/genres for card display
  export let tags: string[] = [];

  // Status labels mapping
  const statusLabels: Record<string, string> = {
    'COMPLETED': "Completed",
    'DROPPED': "Dropped",
    'ONHOLD': "On Hold",
    'PLANTOWATCH': "Watchlist",
    'WATCHING': "Watching",
  };

  const cardStyles = {
    default: `w-48 h-72`,
    'hover-transparent': `w-48 h-72 hover:bg-gray-100 dark:hover:bg-gray-700`,
    hover: `w-48 h-72 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-lg`,
    transparent: `w-48 h-72 bg-transparent`,
    long: `w-96 h-96`,
    detail: ``,
    episode: ``,
  };

  function getAirTimeColorClasses(variant?: string) {
    switch (variant) {
      case 'countdown': return 'text-red-600 dark:text-red-400';
      case 'airing': return 'text-orange-600 dark:text-orange-400';
      case 'aired': return 'text-green-600 dark:text-green-400';
      default: return 'text-blue-600 dark:text-blue-400';
    }
  }
</script>

<div class="flex {forceListLayout ? 'flex-row' : 'sm:flex-row md:flex-col'} dark:bg-gray-800 rounded-md shadow w-full justify-center transition-all duration-300 {className} relative h-full">
  <!-- Watchlist indicator -->
  {#if entry?.status}
    <div class="absolute top-2 left-0 sm:left-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg z-10">
      <i class="fas fa-bookmark text-xs mr-1"></i>
      {statusLabels[entry.status] || 'Unknown'}
    </div>
  {/if}

  <a href="/show/{id}"
     on:click={() => analytics.animeViewed(id || '', title)}
     class="flex flex-col bg-white dark:bg-gray-800 {cardStyles[style]} overflow-hidden transition-colors duration-300 {forceListLayout ? 'rounded-l-md h-full flex-shrink-0 flex-grow-0 w-32' : 'flex-shrink sm:flex-shrink md:flex-shrink-0 rounded-l-md lg:rounded-bl-none lg:rounded-t-md'}">
    <SafeImage
            src={image}
            alt={title}
            className="{forceListLayout ? 'object-cover h-full relative' : 'aspect-2/3 object-cover w-full h-full relative'}"
            fallbackSrc="/assets/not found.jpg"
    />
  </a>

  {#if style === 'detail'}
    <div class="flex flex-col flex-grow min-w-0 px-4 py-2 h-full relative w-full group">
      <a href="/show/{id}" on:click={() => analytics.animeViewed(id || '', title)} class="flex overflow-hidden flex-col w-full flex-grow">
        <ScrollingText
                text={title}
                className="text-md font-bold text-gray-900 dark:text-gray-100"
                maxWidth="100%"
        />

        <ScrollingTags {tags} className="mt-1" />

        <div class="flex flex-col space-y-2 text-md font-normal mt-2 items-start text-gray-700 dark:text-gray-300">
          <div class="flex items-center">
            <i class="fas fa-tv text-sm w-4 text-center mr-2"></i>
            <span>{episodes}</span>
          </div>
          <div class="flex items-center">
            <i class="fas fa-clock text-sm w-4 text-center mr-2"></i>
            <span>{episodeLength}</span>
          </div>
          {#if year}
            <div class="flex items-center">
              <i class="fas fa-calendar text-sm w-4 text-center mr-2"></i>
              <span>{year}</span>
            </div>
          {/if}
          {#if airTime?.show}
            <div class="flex items-center {getAirTimeColorClasses(airTime.variant)}">
              <i class="fas fa-broadcast-tower text-sm w-4 text-center mr-2"></i>
              <span class="text-xs font-medium">{airTime.text}</span>
            </div>
          {/if}
        </div>
      </a>

      <!-- Always positioned at bottom -->
      <div class="flex flex-wrap gap-2 options w-full mt-auto pt-3 {forceListLayout ? 'justify-start' : 'justify-center'}">
        <slot name="options"></slot>
      </div>
    </div>
  {/if}

  {#if style === 'episode'}
    <div class="flex flex-col flex-grow min-w-0 px-4 py-2 h-full relative w-full group">
      <a href="/show/{id}" on:click={() => analytics.animeViewed(id || '', title)} class="flex flex-col overflow-hidden w-full flex-grow">
        <ScrollingText
                text={title}
                className="text-md font-bold text-gray-900 dark:text-gray-100"
                maxWidth="100%"
        />

        <ScrollingTags {tags} className="mt-1" />

        <ScrollingText
                text={episodeTitle}
                className="text-md font-normal text-gray-900 dark:text-gray-100 mt-1"
                maxWidth="100%"
        />

        <div class="flex flex-col w-full justify-between space-y-2">
          <span class="flex-grow text-md text-base space-x-4 text-gray-600 dark:text-gray-400">
            <span>episode {episodeNumber}</span>
          </span>

          {#if airTime?.show}
            <div class="flex items-center {getAirTimeColorClasses(airTime.variant)}">
              <i class="fas fa-broadcast-tower text-sm w-4 text-center mr-2"></i>
              <span class="text-xs font-medium">{airTime.text}</span>
            </div>
          {:else}
            <span class="flex-grow text-md text-base space-x-4 text-gray-600 dark:text-gray-400">
              <span>{airdate}</span>
            </span>
          {/if}
        </div>
      </a>

      <!-- Always positioned at bottom -->
      <div class="flex flex-wrap gap-2 options w-full mt-auto pt-3 {forceListLayout ? 'justify-start' : 'justify-center'}">
        <slot name="options"></slot>
      </div>
    </div>
  {/if}
</div>
