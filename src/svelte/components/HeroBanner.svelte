<script lang="ts">
  import { onMount } from 'svelte';
  import { format } from 'date-fns';
  import Button from './Button.svelte';
  import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
  import { GetImageFromAnime } from '../../services/utils';
  import { findNextEpisode, parseAirTime, getAirDateTime } from '../../services/airTimeUtils';
  import { configStore } from '../stores/config';
  import { animeCountdownStore } from '../stores/animeCountdown';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';

  export let anime: any;
  export let onAddAnime: (animeId: string) => void;
  export let animeStatus: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  export let onDeleteAnime: ((id: string) => void) | undefined = undefined;

  let bgUrl: string | null = null;
  let bgWebPUrl: string | null = null;
  let bgLoaded = false;
  let useFallback = false;
  let showJstPopover = false;
  let currentAnimeId: string | null = null;
  let imageElement: HTMLImageElement;
  let supportsWebP = false;

  // Get timing data from the anime countdown store
  $: timingData = $animeCountdownStore.timingData[anime.id];
  $: workerCountdown = $animeCountdownStore.countdowns[anime.id];

  // Computed timing values (matching React HeroBanner logic)
  $: hasTimingData = Boolean(timingData || workerCountdown);
  $: airDateTime = timingData?.airDateTime || "";
  $: airingToday = timingData?.isAiringToday || false;
  $: currentlyAiring = timingData?.isCurrentlyAiring || workerCountdown?.isAiring || false;
  $: alreadyAired = timingData?.hasAlreadyAired || workerCountdown?.hasAired || false;
  $: countdown = timingData?.countdown || workerCountdown?.countdown || "";
  $: progress = timingData?.progress || workerCountdown?.progress;


  // Episode info from worker
  $: episode = timingData?.episode;
  $: episodeTitle = episode ? (episode.titleEn || episode.titleJp || "Next Episode") : (hasTimingData ? "Next Episode" : "No upcoming episodes");
  $: episodeNumber = episode?.episodeNumber ? `${episode.episodeNumber}` : "";

  // Check WebP support
  function checkWebPSupport(): Promise<boolean> {
    return new Promise((resolve) => {
      const webP = new Image();
      webP.onload = webP.onerror = () => resolve(webP.height === 2);
      webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
    });
  }

  // Initialize config on mount
  onMount(async () => {
    await configStore.init();

    // Check WebP support
    supportsWebP = await checkWebPSupport();
    console.log('🖼️ WebP support:', supportsWebP);

    // Check if image is already loaded (for SSR hydration)
    if (imageElement && imageElement.complete && imageElement.naturalHeight !== 0) {
      console.log('🖼️ HeroBanner background image already loaded on mount for:', anime.id);
      bgLoaded = true;
    }
  });

  // Generate optimized image URLs
  function generateOptimizedImageUrls() {
    const baseParams = new URLSearchParams({
      w: '1920',  // Max width for hero banners
      h: '1080',  // Max height for hero banners
      fit: 'cover',
      q: '85'     // High quality for hero images
    });

    if (supportsWebP) {
      baseParams.set('f', 'webp');
    }

    if (anime.thetvdbid) {
      const baseUrl = `https://weeb-api.staging.weeb.vip/show/anime/series/${anime.thetvdbid}/fanart`;
      bgUrl = `${baseUrl}?${baseParams.toString()}`;
      if (supportsWebP) {
        bgWebPUrl = bgUrl;
      }
    } else if (anime.anidbid) {
      const baseUrl = `https://weeb-api.staging.weeb.vip/show/anime/anidb/series/${anime.anidbid}/fanart`;
      bgUrl = `${baseUrl}?${baseParams.toString()}`;
      if (supportsWebP) {
        bgWebPUrl = bgUrl;
      }
    } else {
      // No anidbid available, use same fallback as anime cards
      bgUrl = GetImageFromAnime(anime);
      bgLoaded = true;
    }
  }

  // Set background URL based on anime data - only reset loading state when anime actually changes
  $: {
    // Only reset the loading state if this is a different anime
    if (currentAnimeId !== anime.id) {
      currentAnimeId = anime.id;
      useFallback = false;
      bgLoaded = false;

      generateOptimizedImageUrls();

      // Check if image is already cached and loaded
      if (bgUrl && imageElement) {
        if (imageElement.complete && imageElement.naturalHeight !== 0) {
          bgLoaded = true;
        }
      }
    }
  }

  // Regenerate URLs when WebP support is detected
  $: if (supportsWebP && currentAnimeId === anime.id) {
    generateOptimizedImageUrls();
  }

  $: title = getAnimeTitle(anime, $preferencesStore.titleLanguage);

  // For now, we'll use a simpler approach without the worker data
  // This can be enhanced later with Svelte stores for countdown data
  const animeNextEpisodeInfo = anime.nextEpisode && (anime.nextEpisode.airDate || anime.nextEpisode.airTime) ? {
    episode: anime.nextEpisode,
    airTime: anime.nextEpisode.airTime ? new Date(anime.nextEpisode.airTime) : new Date(anime.nextEpisode.airDate)
  } : null;
  const airTimeAndDate = parseAirTime(animeNextEpisodeInfo?.episode.airDate, anime.broadcast);

  function handleImageLoad() {
    console.log('🖼️ HeroBanner background image loaded for:', anime.id);
    bgLoaded = true;
  }

  function handleImageError() {
    if (!useFallback && anime.anidbid) {
      // Fanart failed, try poster as fallback
      useFallback = true;
      const config = configStore.get();
      const cdnUrl = config?.cdn_url || 'https://cdn.weeb.vip/weeb-staging';
      bgUrl = `${cdnUrl}/${encodeURIComponent(GetImageFromAnime(anime))}`;
    } else {
      // Poster also failed, use same fallback as anime cards
      bgUrl = "/assets/not found.jpg";
      bgLoaded = true;
    }
  }

  function handleStatusChange(event: CustomEvent) {
    // Handle status change if needed
  }

  function handleDelete(event: CustomEvent) {
    if (onDeleteAnime) {
      onDeleteAnime(anime.id);
    }
  }
</script>

<div class="relative w-full h-[600px] sm:h-[650px] md:h-[700px] rounded-lg">
  <!-- Background layer -->
  <div class="absolute inset-0 overflow-hidden bg-gray-800 md:rounded-lg xs:rounded-none">
    {#if bgUrl}
      <div
        class="absolute inset-0 w-full h-full"
        style="opacity: {bgLoaded ? 1 : 0.1}; transition: opacity 500ms;"
      >
        {#if supportsWebP && bgWebPUrl}
          <picture>
            <source srcset={bgWebPUrl} type="image/webp">
            <img
              bind:this={imageElement}
              src={bgUrl}
              alt="Anime background"
              loading="eager"
              decoding="async"
              fetchpriority="high"
              width="1920"
              height="1080"
              class="absolute w-full h-full object-cover {useFallback ? 'blur-md scale-110 -inset-4' : 'inset-0'} transition-all duration-500"
              on:load={handleImageLoad}
              on:error={handleImageError}
            />
          </picture>
        {:else}
          <img
            bind:this={imageElement}
            src={bgUrl}
            alt="Anime background"
            loading="eager"
            decoding="async"
            fetchpriority="high"
            width="1920"
            height="1080"
            class="absolute w-full h-full object-cover {useFallback ? 'blur-md scale-110 -inset-4' : 'inset-0'} transition-all duration-500"
            on:load={handleImageLoad}
            on:error={handleImageError}
          />
        {/if}
      </div>
    {/if}

    <!-- overlays -->
    <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent"></div>
    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
  </div>

  <!-- Foreground content (not clipped) -->
  <div class="relative z-10 h-full flex items-end px-4 sm:px-8 lg:px-16">
    <div class="max-w-3xl text-white py-12">
      <!-- Current airing status badge -->
      {#if hasTimingData && currentlyAiring}
        <div class="relative inline-flex items-center px-4 py-2 rounded-full bg-orange-600 text-sm font-semibold mb-4 overflow-hidden">
          <!-- Progress bar background -->
          {#if progress !== undefined}
            <div
              class="absolute inset-0 bg-orange-800/60 transition-all duration-1000 ease-out"
              style="width: {progress * 100}%"
            ></div>
          {/if}
          <!-- Content -->
          <span class="relative w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
          <span class="relative">CURRENTLY AIRING</span>
        </div>
      {/if}

      <!-- Airing soon status badge -->
      {#if hasTimingData && !currentlyAiring && !alreadyAired}
        <div class="inline-flex items-center px-4 py-2 rounded-full bg-red-600 text-sm font-semibold mb-4">
          <span class="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
          {countdown === "JUST AIRED" ? "JUST AIRED" : "AIRING SOON"}
          {#if countdown && !countdown.includes("JUST AIRED") && countdown !== "AIRING NOW"}
            <span class="ml-2 px-2 py-1 bg-black/25 rounded text-xs font-medium">
              {countdown.includes("left") ? countdown : `in ${countdown}`}
            </span>
          {/if}
        </div>
      {/if}

      <!-- Recently aired status badge -->
      {#if hasTimingData && alreadyAired && !currentlyAiring}
        <div class="inline-flex items-center px-4 py-2 rounded-full bg-green-600 text-sm font-semibold mb-4">
          <span class="w-2 h-2 bg-white rounded-full mr-2"></span>
          RECENTLY AIRED
        </div>
      {/if}

      <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">{title}</h1>

      {#if (hasTimingData && airDateTime) || (animeNextEpisodeInfo && airTimeAndDate)}
        <div class="mb-6 sm:mb-8 space-y-3 sm:space-y-4">
          <p class="text-lg sm:text-xl lg:text-2xl font-medium">
            {#if hasTimingData && airDateTime}
              {episodeNumber ? `Episode ${episodeNumber}: ${episodeTitle}` : episodeTitle}
            {:else if animeNextEpisodeInfo && airTimeAndDate}
              {animeNextEpisodeInfo?.episode.episodeNumber ? `Episode ${animeNextEpisodeInfo?.episode.episodeNumber}: ${animeNextEpisodeInfo?.episode.titleEn || animeNextEpisodeInfo?.episode.titleJp || "Next Episode"}` : "Next Episode"}
            {/if}
          </p>
          <div class="flex flex-col sm:flex-row sm:items-center gap-2">
            <p class="text-base sm:text-lg text-gray-300">
              {#if hasTimingData && airDateTime}
                Airing {airDateTime}
              {:else if animeNextEpisodeInfo}
                {@const airTime = animeNextEpisodeInfo.airTime}
                Airing {format(airTime, "EEE MMM do")} at {format(airTime, "h:mm a")}
              {:else}
                Airing soon
              {/if}
            </p>
            {#if anime.broadcast}
              <div class="relative">
                <span
                  class="px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-xs font-medium cursor-help"
                  on:mouseenter={() => showJstPopover = true}
                  on:mouseleave={() => showJstPopover = false}
                >
                  JST Broadcast
                </span>
                <div
                  class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 transition-all duration-200 ease-out pointer-events-none"
                  style="opacity: {showJstPopover ? 1 : 0}; transform: translateX(-50%) translateY({showJstPopover ? '0' : '8px'});"
                >
                  <div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm rounded-lg p-3 w-80 max-w-[calc(100vw-2rem)]" style="box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1);">
                    <div class="text-center">
                      <p class="text-gray-700 dark:text-gray-200">
                        Japanese TV broadcast time (in local time). Streaming services usually release with 3 hours after show ends.
                      </p>
                    </div>
                    <div class="absolute top-full left-4 sm:left-1/2 sm:transform sm:-translate-x-1/2 border-8 border-transparent border-t-white dark:border-t-gray-900"></div>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if anime.description}
        <p class="text-gray-200 text-sm sm:text-base lg:text-lg mb-6 sm:mb-8 line-clamp-3">
          {anime.description.length > 250
            ? `${anime.description.substring(0, 250)}...`
            : anime.description}
        </p>
      {/if}

      <div class="flex flex-wrap gap-4 items-center">
        <a href="/show/{anime.id}">
          <Button
            color="blue"
            label="More Info"
            showLabel={true}
            className="px-4 py-2 text-base font-semibold shadow-md hover:shadow-lg"
          />
        </a>

        {#if !anime.userAnime}
          <Button
            color="transparent"
            label="Add to List"
            showLabel={true}
            status={animeStatus}
            onClick={() => onAddAnime(anime.id)}
            className="px-4 py-2 text-base font-semibold text-white hover:bg-white hover:text-black focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transition"
          />
        {:else}
          <AnimeStatusDropdown
            entry={{...anime.userAnime, anime}}
            variant="hero"
            on:statusChange={handleStatusChange}
            on:delete={handleDelete}
          />
        {/if}
      </div>
    </div>
  </div>
</div>