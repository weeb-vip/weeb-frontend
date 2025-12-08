<script lang="ts">
  import { onMount } from 'svelte';
  import { format } from 'date-fns';
  import Button from './Button.svelte';
  import AnimeActions from './AnimeActions.svelte';
  import SafeImage from './SafeImage.svelte';
  import { GetImageFromAnime } from '../../services/utils';
  import { findNextEpisode, parseAirTime, getAirDateTime } from '../../services/airTimeUtils';
  import { configStore } from '../stores/config';
  import { animeCountdownStore } from '../stores/animeCountdown';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';

  export let anime: any;

  let imageSources: string[] = [];
  let bgLoaded = false;
  let showJstPopover = false;
  let currentAnimeId: string | null = null;
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
  });

  // Generate ordered list of image sources to try
  function generateImageSources(): string[] {
    const sources: string[] = [];

    const baseParams = new URLSearchParams({
      w: '1920',  // Max width for hero banners
      h: '1080',  // Max height for hero banners
      fit: 'cover',
      q: '85'     // High quality for hero images
    });

    if (supportsWebP) {
      baseParams.set('f', 'webp');
    }

    // Priority 1: TVDB fanart (highest quality)
    if (anime.thetvdbid) {
      const baseUrl = `https://weeb-api.staging.weeb.vip/show/anime/series/${anime.thetvdbid}/fanart`;
      sources.push(`${baseUrl}?${baseParams.toString()}`);
    }

    // Priority 2: AniDB fanart
    if (anime.anidbid) {
      const baseUrl = `https://weeb-api.staging.weeb.vip/show/anime/anidb/series/${anime.anidbid}/fanart`;
      sources.push(`${baseUrl}?${baseParams.toString()}`);
    }

    // Priority 3: CDN poster as fallback
    const posterUrl = GetImageFromAnime(anime);
    if (posterUrl) {
      sources.push(`https://cdn.weeb.vip/weeb/${encodeURIComponent(posterUrl)}`);
    }

    return sources;
  }

  // Update sources when anime changes
  $: {
    if (currentAnimeId !== anime.id) {
      currentAnimeId = anime.id;
      bgLoaded = false;
      imageSources = generateImageSources();
      console.log('🖼️ Generated image sources for', anime.id, ':', imageSources);
    }
  }

  // Regenerate sources when WebP support is detected
  $: if (supportsWebP && currentAnimeId === anime.id) {
    imageSources = generateImageSources();
  }

  $: title = getAnimeTitle(anime, $preferencesStore.titleLanguage);

  // For now, we'll use a simpler approach without the worker data
  // This can be enhanced later with Svelte stores for countdown data
  const animeNextEpisodeInfo = anime.nextEpisode && (anime.nextEpisode.airDate || anime.nextEpisode.airTime) ? {
    episode: anime.nextEpisode,
    airTime: anime.nextEpisode.airTime ? new Date(anime.nextEpisode.airTime) : new Date(anime.nextEpisode.airDate)
  } : null;
  const airTimeAndDate = parseAirTime(animeNextEpisodeInfo?.episode.airDate, anime.broadcast);

  function handleImageChosen(event: CustomEvent) {
    console.log('🖼️ HeroBanner image chosen:', event.detail);
    bgLoaded = true;
  }

</script>

<div class="relative w-full h-[600px] sm:h-[650px] md:h-[700px] rounded-lg">
  <!-- Background layer -->
  <div class="absolute inset-0 overflow-hidden bg-gray-800 md:rounded-lg xs:rounded-none">
    {#if imageSources.length > 0}
      <div
        class="absolute inset-0 w-full h-full"
        style="opacity: {bgLoaded ? 1 : 0.1}; transition: opacity 500ms;"
      >
        <SafeImage
          sources={imageSources}
          alt="Anime background"
          loading="eager"
          priority={true}
          fallbackSrc="/assets/not found.jpg"
          perTryTimeoutMs={3000}
          className="absolute w-full h-full object-cover  transition-all duration-500"
          style=""
          on:chosen={handleImageChosen}
        />
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

      {#if anime.tags && anime.tags.length > 0}
        <div class="flex flex-wrap gap-2 mb-4">
          {#each anime.tags.slice(0, 5) as tag}
            <span class="inline-block bg-white/20 backdrop-blur-sm rounded-md px-3 py-1 text-sm font-medium text-white/90 whitespace-nowrap">
              {tag}
            </span>
          {/each}
        </div>
      {/if}

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

        <AnimeActions
          {anime}
          variant="hero"
          statusKey="hero-{anime.id}"
        />
      </div>
    </div>
  </div>
</div>
