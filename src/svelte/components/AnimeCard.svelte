<script lang="ts">
  import { onMount } from 'svelte';
  import SafeImage from './SafeImage.svelte';

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

<div class="flex {forceListLayout ? 'flex-row' : 'sm:flex-row md:flex-col'} dark:bg-gray-800 rounded-md shadow w-full justify-center transition-all duration-300 {className} relative">
  <!-- Watchlist indicator -->
  {#if entry?.status}
    <div class="absolute top-2 left-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg z-10">
      <svg class="w-3 h-3 mr-1 inline" fill="currentColor" viewBox="0 0 20 20">
        <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"/>
      </svg>
      {statusLabels[entry.status] || 'Unknown'}
    </div>
  {/if}

  <a href="/show/{id}"
     class="flex flex-col flex-none bg-white dark:bg-gray-800 {cardStyles[style]} flex-grow overflow-hidden transition-colors duration-300 {forceListLayout ? 'rounded-l-md' : 'rounded-l-md lg:rounded-bl-none lg:rounded-t-md'}">
    <SafeImage
      src={image}
      alt={title}
      className="aspect-2/3 object-cover flex-auto relative {forceListLayout ? 'w-24 sm:w-28 md:w-32' : 'w-32 sm:w-40 md:w-48'}"
      fallbackSrc="/assets/not found.jpg"
    />
  </a>

  {#if style === 'detail'}
    <div class="flex flex-col flex-grow min-w-0 sm:justify-start sm:align-left p-4 sm:w-full lg:w-full space-y-4 h-full relative w-full group">
      <a href="/show/{id}" class="flex overflow-hidden flex-col w-full">
        <div class="group w-full">
          <!-- Default (visible) -->
          <span class="block whitespace-nowrap text-md font-bold w-full truncate group-hover:hidden text-gray-900 dark:text-gray-100">
            {title}
          </span>

          <!-- On hover (revealed) -->
          <span class="hidden group-hover:block whitespace-nowrap w-max text-md font-bold group-hover:animate-marquee text-gray-900 dark:text-gray-100">
            {title}
          </span>
        </div>

        <div class="flex flex-col space-y-2 text-md font-normal mt-2 items-start text-gray-700 dark:text-gray-300">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
            </svg>
            <span>{episodes}</span>
          </div>
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
            </svg>
            <span>{episodeLength}</span>
          </div>
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
            </svg>
            <span>{year}</span>
          </div>
          {#if airTime?.show}
            <div class="flex items-center gap-2 {getAirTimeColorClasses(airTime.variant)}">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
              </svg>
              <span class="text-xs font-medium">{airTime.text}</span>
            </div>
          {/if}
        </div>
      </a>

      <div class="flex flex-wrap gap-2 options w-full {forceListLayout ? 'justify-start' : 'justify-center'}">
        <slot name="options"></slot>
      </div>
    </div>
  {/if}

  {#if style === 'episode'}
    <div class="flex flex-col flex-grow min-w-0 sm:justify-start sm:align-left p-4 sm:w-full lg:w-full space-y-4 h-full relative w-full group">
      <a href="/show/{id}" class="flex flex-col overflow-hidden w-full">
        <div class="group w-full">
          <!-- Default (visible) -->
          <span class="block whitespace-nowrap text-md font-bold w-full truncate group-hover:hidden text-gray-900 dark:text-gray-100">
            {title}
          </span>

          <!-- On hover (revealed) -->
          <span class="hidden group-hover:block whitespace-nowrap text-md font-bold group-hover:animate-marquee text-gray-900 dark:text-gray-100">
            {title}
          </span>
        </div>

        <div class="group w-full">
          <!-- Default (visible) -->
          <span class="block whitespace-nowrap text-md font-normal w-full truncate group-hover:hidden text-gray-900 dark:text-gray-100">
            {episodeTitle}
          </span>

          <!-- On hover (revealed) -->
          <span class="hidden group-hover:block whitespace-nowrap text-md font-normal group-hover:animate-marquee text-gray-900 dark:text-gray-100">
            {episodeTitle}
          </span>
        </div>

        <div class="flex flex-col w-full justify-between space-y-2">
          <span class="flex-grow text-md text-base space-x-4 text-gray-600 dark:text-gray-400">
            <span>episode {episodeNumber}</span>
          </span>

          {#if airTime?.show}
            <div class="flex items-center gap-2 {getAirTimeColorClasses(airTime.variant)}">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
              </svg>
              <span class="text-xs font-medium">{airTime.text}</span>
            </div>
          {:else}
            <span class="flex-grow text-md text-base space-x-4 text-gray-600 dark:text-gray-400">
              <span>{airdate}</span>
            </span>
          {/if}
        </div>
      </a>

      <div class="flex flex-wrap gap-2 options w-full {forceListLayout ? 'justify-start' : 'justify-center'}">
        <slot name="options"></slot>
      </div>
    </div>
  {/if}
</div>