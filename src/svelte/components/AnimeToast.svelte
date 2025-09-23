<script lang="ts">
  import { onMount } from 'svelte';
  import { navigateWithTransition } from '../../utils/astro-navigation';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';

  export let anime: {
    id?: string | number;
    titleEn?: string;
    titleJp?: string;
    imageUrl?: string;
  };
  export let episode: {
    episodeNumber?: number;
    titleEn?: string;
    titleJp?: string;
  };
  export let status: 'airing-soon' | 'airing' | 'finished' | 'warning';
  export let timeInfo: string = '';

  let isMobile = false;

  onMount(() => {
    // Check if mobile/tablet including iPads
    const checkIfMobile = () => {
      // Check for touch capability (includes iPads)
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // Check viewport width (less than lg breakpoint)
      const isNarrowScreen = window.innerWidth < 1024;

      // Check for iPad specifically (including iPad Pro)
      const isIPad = /iPad|Macintosh/.test(navigator.userAgent) && hasTouch;

      // Check for other tablets and mobile devices
      const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      return isNarrowScreen || isIPad || (hasTouch && isMobileUserAgent);
    };

    isMobile = checkIfMobile();

    const handleResize = () => {
      isMobile = checkIfMobile();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  function handleShowClick(e: MouseEvent) {
    e.stopPropagation();
    if (anime.id) {
      navigateWithTransition(`/show/${anime.id}`);
    }
  }

  function handleContainerClick(e: MouseEvent) {
    // On desktop, clicking the container navigates to the show
    if (!isMobile && anime.id) {
      navigateWithTransition(`/show/${anime.id}`);
    }
  }

  const title = getAnimeTitle(anime, $preferencesStore.titleLanguage);
  const episodeTitle = episode?.titleEn || episode?.titleJp || '';
  const episodeNumber = episode?.episodeNumber || '?';

  const statusConfig = {
    'airing-soon': {
      icon: 'fa-clock',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800'
    },
    'airing': {
      icon: 'fa-play-circle',
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800'
    },
    'finished': {
      icon: 'fa-check-circle',
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800'
    },
    'warning': {
      icon: 'fa-bell',
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-orange-200 dark:border-orange-800'
    }
  };

  const config = statusConfig[status];
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="anime-toast-content flex items-center gap-3 w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-full shadow-lg pl-2 pr-2 py-2 transition-all duration-300 ease-in-out {!isMobile ? 'cursor-pointer hover:bg-white/90 dark:hover:bg-gray-800/90 hover:shadow-xl' : ''}"
  on:click={handleContainerClick}
>
  <!-- Anime Image -->
  <div class="flex-shrink-0">
    {#if anime.imageUrl}
      <img
        src={anime.imageUrl}
        alt={title}
        class="w-14 h-14 object-cover rounded-full shadow-sm"
        loading="lazy"
      />
    {:else}
      <div class="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
        <i class="fas fa-image text-gray-400 dark:text-gray-500"></i>
      </div>
    {/if}
  </div>

  <!-- Content -->
  <div class="flex-1 min-w-0 pr-2">
    <!-- Anime Title -->
    <div class="font-semibold text-sm text-gray-900 dark:text-white truncate transition-colors duration-300">
      {title}
    </div>

    <!-- Episode Info -->
    <div class="text-xs text-gray-800 dark:text-gray-200 truncate transition-colors duration-300">
      <span class="font-medium">Episode {episodeNumber}</span>
      {#if episodeTitle}
        <span class="mx-1 opacity-60">•</span>
        <span class="opacity-90">{episodeTitle}</span>
      {/if}
    </div>

    <!-- Status Info -->
    {#if timeInfo}
      <div class="flex items-center gap-1.5 mt-1">
        <i class="fas {config.icon} {config.color} text-xs"></i>
        <span class="text-xs font-semibold {config.color}">
          {timeInfo}
        </span>
      </div>
    {/if}
  </div>

  <!-- Go to Show Button (mobile only) or Status Icon (desktop) -->
  {#if isMobile}
    <div class="flex-shrink-0 mr-2">
      <button
        on:click={handleShowClick}
        class="w-10 h-10 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white border border-blue-600 dark:border-blue-700 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-lg"
        type="button"
        title="Go to {title} page"
        aria-label="Go to {title} page"
      >
        <i class="fas fa-arrow-right text-sm"></i>
      </button>
    </div>
  {:else}
    <div class="flex-shrink-0 mr-2">
      <div class="w-10 h-10 {config.bgColor} {config.borderColor} border rounded-full flex items-center justify-center">
        <i class="fas {config.icon} {config.color} text-base"></i>
      </div>
    </div>
  {/if}
</div>
