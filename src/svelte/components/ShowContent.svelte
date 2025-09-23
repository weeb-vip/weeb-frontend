<script lang="ts">
  import { onMount } from 'svelte';
  import { format } from 'date-fns';
  import { createQuery, createMutation } from '@tanstack/svelte-query';
  import SafeImage from './SafeImage.svelte';
  import Button from './Button.svelte';
  import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
  import Tabs from './Tabs.svelte';
  import Tag from './Tag.svelte';
  import Episodes from './Episodes.svelte';
  import CharactersWithStaff from './CharactersWithStaff.svelte';
  import { fetchDetails, upsertAnime, deleteAnime } from '../../services/queries';
  import { GetImageFromAnime } from '../../services/utils';
  import { findNextEpisode, getCurrentTime, getAirTimeDisplay, parseDurationToMinutes, parseAirTime, getAirDateTime } from '../../services/airTimeUtils';
  import debug from '../../utils/debug';
  import { animeNotificationStore } from '../stores/animeNotifications';
  import ShowContentSkeleton from './ShowContentSkeleton.svelte';
  export let animeId: string;
  export let ssrAnimeData: any = null;
  export let ssrCharactersData: any = null;
  export let ssrError: any = null;

  let bgUrl: string | null = null;
  let bgLoaded = false;
  let useFallback = false;
  let showStickyHeader = false;
  let animeStatuses: Record<string, 'idle' | 'loading' | 'success' | 'error'> = {};

  // Data state variables
  let showQueryStore: any = null;
  let showQuery: any = null;
  let show: any = null;
  let anime: any = null;
  let isLoading = true;
  let isError = false;
  let charactersData: any = null;

  // Initialize data from SSR if available
  if (ssrAnimeData) {
    show = ssrAnimeData;
    anime = ssrAnimeData.anime;
    isLoading = false;
    isError = false;
    console.log('🏃‍♂️ [ShowContent] Using SSR anime data');
  }

  if (ssrCharactersData) {
    charactersData = ssrCharactersData;
    console.log('🏃‍♂️ [ShowContent] Using SSR characters data');
  }

  if (ssrError) {
    isError = true;
    isLoading = false;
    console.error('🏃‍♂️ [ShowContent] SSR error:', ssrError);
  }

  onMount(() => {
    console.log('ShowContent onMount called with animeId:', animeId);

    // Only create client-side query if we don't have SSR data
    if (!ssrAnimeData) {
      console.log('🔄 [ShowContent] No SSR data, creating client-side query');
      showQueryStore = createQuery(fetchDetails(animeId));

      // Subscribe to query changes
      showQueryStore.subscribe((value: any) => {
        console.log('Query value updated:', value);
        showQuery = value; // Store the actual query object
        show = value.data;
        anime = show?.anime;
        isLoading = value.isLoading;
        isError = value.isError;
      });
    } else {
      console.log('✅ [ShowContent] Using SSR data, skipping client-side query');
      // Create a mock query object for mutations that still need to refetch
      showQuery = {
        refetch: () => {
          console.log('🔄 [ShowContent] Refetch called, creating query for mutations');
          if (!showQueryStore) {
            showQueryStore = createQuery(fetchDetails(animeId));
            showQueryStore.subscribe((value: any) => {
              show = value.data;
              anime = show?.anime;
              isLoading = value.isLoading;
              isError = value.isError;
            });
          }
        }
      };
    }

    // Initialize mutation
    addAnimeMutation = createMutation({
      ...upsertAnime(),
      onSuccess: () => {
        // Invalidate and refetch queries
        if (showQuery && showQuery.refetch) {
          showQuery.refetch();
        }
      }
    });

    // Subscribe to mutation store to get the actual mutation value
    addAnimeMutation.subscribe((value: any) => {
      mutationStore = value;
      console.log('Add mutation store updated:', mutationStore);
    });

    // Initialize delete mutation
    deleteAnimeMutation = createMutation({
      ...deleteAnime(),
      onSuccess: () => {
        // Invalidate and refetch queries
        if (showQuery && showQuery.refetch) {
          showQuery.refetch();
        }
      }
    });

    // Subscribe to delete mutation store
    deleteAnimeMutation.subscribe((value: any) => {
      deleteMutationStore = value;
      console.log('Delete mutation store updated:', deleteMutationStore);
    });
  });

  // Set background image based on anime data
  $: if (anime?.thetvdbid) {
    bgUrl = `https://weeb-api.staging.weeb.vip/show/anime/series/${anime.thetvdbid}/fanart`;
  } else if (anime?.anidbid) {
    bgUrl = `https://weeb-api.staging.weeb.vip/show/anime/anidb/series/${anime.anidbid}/fanart`;
  } else {
    bgUrl = "/assets/not found.jpg";
    bgLoaded = true;
  }

  // Find next episode
  const now = getCurrentTime();
  $: nextEpisodeResult = anime?.episodes && anime.broadcast
    ? findNextEpisode(anime.episodes, anime.broadcast, now)
    : null;
  $: nextEpisode = nextEpisodeResult?.episode;

  // Calculate air time display and status
  $: airTimeDisplay = nextEpisode && anime ? getAirTimeDisplay(nextEpisode.airDate, anime.broadcast, parseDurationToMinutes(anime.duration)) : null;
  $: airTime = nextEpisodeResult?.airTime;

  $: statusConfig = {
    airing: { color: 'text-orange-600 dark:text-orange-400', text: 'Airing', icon: 'fa-clapperboard' },
    aired: { color: 'text-green-600 dark:text-green-400', text: 'Recently Aired', icon: 'fa-calendar' },
    countdown: { color: 'text-red-600 dark:text-red-400', text: 'Airing Soon', icon: 'fa-clock' },
    scheduled: { color: 'text-blue-600 dark:text-blue-400', text: 'Next Episode', icon: 'fa-calendar' }
  };

  // Hero banner style timing data (from notification store)
  $: timingDataStore = anime?.id ? animeNotificationStore.getTimingData(anime.id) : null;
  $: countdownStore = anime?.id ? animeNotificationStore.getCountdown(anime.id) : null;
  $: timingData = timingDataStore ? $timingDataStore : null;
  $: workerCountdown = countdownStore ? $countdownStore : null;

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

  // JST popover state
  let showJstPopover = false;

  // For fallback air time calculation (same as hero banner)
  $: animeNextEpisodeInfo = anime ? findNextEpisode(anime.episodes, anime.broadcast) : null;
  $: airTimeAndDate = animeNextEpisodeInfo ? parseAirTime(animeNextEpisodeInfo?.episode.airDate, anime.broadcast) : null;

  $: status = airTimeDisplay?.variant || 'scheduled';
  $: config = statusConfig[status] || statusConfig.scheduled;

  // Handle scroll for sticky header
  onMount(() => {
    const handleScroll = () => {
      const scrollThreshold = 400;
      showStickyHeader = window.scrollY > scrollThreshold;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  });

  // Handle add anime
  let addAnimeMutation: any = null;
  let mutationStore: any = null;
  let deleteAnimeMutation: any = null;
  let deleteMutationStore: any = null;

  async function handleAddAnime() {
    console.log('🎯 ADD ANIME CLICKED! handleAddAnime called', { anime, mutationStore });
    if (!anime || !mutationStore) {
      console.log('❌ Early return - missing anime or mutation', { anime: !!anime, mutationStore: !!mutationStore });
      return;
    }
    animeStatuses = { ...animeStatuses, [anime.id]: 'loading' };

    try {
      console.log('🚀 Calling mutateAsync...');
      // In Svelte, we need to use $mutationStore to get the current value
      await mutationStore.mutateAsync({
        input: { animeID: anime.id, status: 'PLANTOWATCH' }
      });
      console.log('✅ Mutation successful');
      animeStatuses = { ...animeStatuses, [anime.id]: 'success' };
    } catch (error) {
      console.error('❌ Mutation failed:', error);
      animeStatuses = { ...animeStatuses, [anime.id]: 'error' };
    }
  }

  async function handleDeleteAnime(event: CustomEvent) {
    console.log('🗑️ DELETE ANIME CLICKED!', event.detail);
    const animeId = event.detail?.animeId;

    if (!animeId || !deleteMutationStore) {
      console.log('❌ Cannot delete - missing animeId or mutation', { animeId, deleteMutationStore: !!deleteMutationStore });
      return;
    }

    try {
      console.log('🚀 Calling delete mutation for anime ID:', animeId);
      await deleteMutationStore.mutateAsync(animeId);
      console.log('✅ Delete successful');
    } catch (error) {
      console.error('❌ Delete failed:', error);
    }
  }

  function handleBgError() {
    if (!useFallback && anime) {
      useFallback = true;
      const posterUrl = `https://cdn.weeb.vip/${encodeURIComponent(GetImageFromAnime(anime))}`;
      bgUrl = posterUrl;
      bgLoaded = true;
    } else {
      bgUrl = "/assets/not found.jpg";
      bgLoaded = true;
    }
  }

  function renderField(label: string, value: string | string[] | null | undefined): { label: string; value: string | string[] } | null {
    if (!value) return null;
    return { label, value };
  }
</script>

{#if isLoading}
  <ShowContentSkeleton />
{:else if isError || !anime}
  <div class="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
    <p class="text-gray-500 dark:text-gray-400">Failed to load anime details</p>
  </div>
{:else}
  <div class="min-h-screen bg-white dark:bg-gray-900 relative transition-colors duration-300">
    <!-- Sticky Header -->
    <div class="fixed top-24 left-0 right-0 z-30 transition-all duration-300 {showStickyHeader ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}">
      <!-- Background container with overflow hidden -->
      <div class="relative overflow-hidden border-b border-gray-200 dark:border-gray-700 px-4 py-4 shadow-md">
        <!-- Background with blur -->
        <div
          class="absolute inset-0 bg-cover bg-center"
          style="background-image: {bgUrl ? `url(${bgUrl})` : 'none'}; filter: blur(8px); transform: scale(1.1);"
        ></div>
        <div class="absolute inset-0 bg-white/90 dark:bg-black/60 backdrop-blur-sm"></div>
        <div class="max-w-screen-2xl mx-auto relative z-10">
          <div class="flex items-center gap-4">
            <SafeImage
              src={GetImageFromAnime(anime)}
              alt={anime.titleEn || ""}
              className="w-8 h-12 object-cover rounded flex-shrink-0"
              fallbackSrc="/assets/not found.jpg"
            />
            <div class="min-w-0 flex-1 pr-16">
              <h1 class="text-xl font-bold text-gray-900 dark:text-white truncate">
                {anime.titleEn}
              </h1>
              <p class="text-sm text-gray-600 dark:text-gray-200 truncate">
                {anime.startDate ? format(new Date(anime.startDate), "yyyy") : ""} • {anime.endDate ? "Finished" : "Ongoing"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Floating button outside the overflow container -->
      <div class="absolute top-1/2 -translate-y-1/2 right-4 flex items-center z-20">
        {#if !anime.userAnime}
          <Button
            color="blue"
            icon='<i class="fas fa-plus w-3 h-3" style="display: flex; align-items: center; justify-content: center; line-height: 1;"></i>'
            showLabel={false}
            status={animeStatuses[anime.id] || 'idle'}
            onClick={handleAddAnime}
            className="w-8 h-8 rounded-full flex items-center justify-center p-0"
          />
        {:else}
          <AnimeStatusDropdown
            entry={{
              id: anime.userAnime.id || '',
              anime: anime,
              status: anime.userAnime.status || undefined
            }}
            variant="icon-only"
            on:delete={handleDeleteAnime}
          />
        {/if}
      </div>
    </div>

    <!-- Hero Background -->
    <div
      class="relative bg-cover bg-center bg-white dark:bg-gray-900 h-[600px] transition-all duration-300 overflow-hidden"
      style="background-image: {bgUrl ? `url(${bgUrl})` : 'none'};"
    >
      <div class="absolute block inset-0 bg-white dark:bg-gray-900 w-full h-full transition-colors duration-300"></div>

      {#if bgUrl}
        <div
          class="absolute inset-0 w-full h-full"
          style="opacity: {bgLoaded ? 1 : 0}; transition: opacity 300ms;"
        >
          <img
            src={bgUrl}
            alt="bg preload"
            class="absolute w-full h-full object-cover {useFallback ? 'blur-md scale-110 -inset-4' : 'inset-0'} transition-all duration-300"
            on:load={() => bgLoaded = true}
            on:error={handleBgError}
          />
        </div>
      {/if}
    </div>

    <!-- Main Content -->
    <div class="bg-gray-100 dark:bg-gray-900 -mt-[350px] lg:-mt-[200px] transition-colors duration-300">
      <div class="relative z-10 flex justify-center pt-20">
        <div class="flex flex-col lg:flex-row items-start max-w-screen-2xl w-full mx-4 lg:mx-auto p-6 text-white backdrop-blur-lg bg-black/50 rounded-md shadow-md">
          <SafeImage
            src={GetImageFromAnime(anime)}
            alt={anime.titleEn || ""}
            className="h-48 w-32 lg:h-64 lg:w-48 object-cover rounded-md"
            fallbackSrc="/assets/not found.jpg"
          />
          <div class="lg:ml-10 mt-4 lg:mt-0 space-y-4 w-full">
            <h1 class="text-3xl font-bold">{anime.titleEn}</h1>
            <p class="text-sm leading-relaxed text-neutral-200">{anime.description}</p>
            <div class="flex flex-wrap gap-4 text-sm text-neutral-300">
              <span>{anime.startDate ? format(new Date(anime.startDate), "yyyy") : ""}</span>
              <span>{anime.broadcast || "unknown"}</span>
              <span>{anime.endDate ? "Finished" : "Ongoing"}</span>
            </div>
            <div class="flex flex-wrap gap-2">
              {#each anime.tags || [] as tag}
                <Tag {tag} />
              {/each}
            </div>
            <div class="flex flex-wrap gap-2 mt-4">
              {#if !anime.userAnime}
                <Button
                  color="blue"
                  label="Add to list"
                  status={animeStatuses[anime.id] || 'idle'}
                  onClick={handleAddAnime}
                />
              {:else}
                <AnimeStatusDropdown
                  entry={{
                    ...anime.userAnime,
                    anime: anime
                  }}
                  variant="default"
                  on:delete={handleDeleteAnime}
                />
              {/if}
            </div>
          </div>
        </div>
      </div>

      <div class="bg-gray-100 dark:bg-gray-900 py-8 px-4 sm:px-8 lg:px-16 transition-colors duration-300">
        <div class="max-w-screen-2xl mx-auto flex flex-col gap-8">
          <!-- Next Episode Info -->
          {#if hasTimingData || (episode && animeNextEpisodeInfo)}
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:border-gray-700 p-4 transition-colors duration-300">
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="flex flex-col sm:flex-row sm:items-center gap-3">
                  <!-- Status badge -->
                  {#if hasTimingData && currentlyAiring}
                    <div class="relative inline-flex items-center px-3 py-1 rounded-full bg-orange-600 text-xs font-semibold overflow-hidden text-white w-fit">
                      {#if progress !== undefined}
                        <div
                          class="absolute inset-0 bg-orange-400 transition-all duration-1000 ease-out"
                          style="width: {progress}%"
                        ></div>
                      {/if}
                      <span class="relative z-10 w-1.5 h-1.5 bg-white rounded-full mr-2 animate-pulse"></span>
                      <span class="relative z-10">AIRING NOW</span>
                    </div>
                  {:else if hasTimingData && !currentlyAiring && !alreadyAired}
                    <div class="inline-flex items-center px-3 py-1 rounded-full bg-red-600 text-xs font-semibold text-white w-fit">
                      <span class="w-1.5 h-1.5 bg-white rounded-full mr-2 animate-pulse"></span>
                      {countdown === "JUST AIRED" ? "JUST AIRED" : "AIRING SOON"}
                      {#if countdown && !countdown.includes("JUST AIRED") && !countdown.includes("AIRING NOW")}
                        <span class="ml-2 px-1.5 py-0.5 bg-black/25 rounded text-xs font-medium">
                          in {countdown}
                        </span>
                      {/if}
                    </div>
                  {:else}
                    <div class="inline-flex items-center px-3 py-1 rounded-full bg-blue-600 text-xs font-semibold text-white w-fit">
                      <i class="fas fa-calendar w-3 h-3 mr-2"></i>
                      NEXT EPISODE
                    </div>
                  {/if}

                  <!-- Episode info -->
                  <div class="min-w-0 flex-1">
                    <span class="font-bold text-gray-900 dark:text-gray-100">
                      {#if episode}
                        Episode {episode.episodeNumber}
                      {:else if animeNextEpisodeInfo}
                        Episode {animeNextEpisodeInfo?.episode.episodeNumber || "TBA"}
                      {/if}
                    </span>
                    <span class="text-gray-600 dark:text-gray-400 ml-2 block sm:inline truncate">
                      {#if episode}
                        {episodeTitle}
                      {:else if animeNextEpisodeInfo}
                        {animeNextEpisodeInfo?.episode.titleEn || animeNextEpisodeInfo?.episode.titleJp || "TBA"}
                      {/if}
                    </span>
                  </div>
                </div>

                <!-- Air time info -->
                <div class="flex items-center gap-2 text-gray-600 dark:text-gray-300 flex-shrink-0 self-start sm:self-center">
                  <i class="fas fa-clock text-xs"></i>
                  <span class="text-sm font-medium">
                    {airDateTime || (airTimeAndDate && getAirDateTime(animeNextEpisodeInfo?.episode.airDate, anime.broadcast)) || "TBA"}
                  </span>
                  {#if anime.broadcast}
                    <div class="relative">
                      <span
                        class="px-2 py-1 bg-blue-600/20 text-blue-600 dark:text-blue-300 rounded text-xs font-medium cursor-help"
                        on:mouseenter={() => showJstPopover = true}
                        on:mouseleave={() => showJstPopover = false}
                      >
                        JST
                      </span>
                      {#if showJstPopover}
                        <div class="absolute bottom-full right-0 mb-2 z-50">
                          <div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm rounded-lg p-3 w-72 sm:w-80 max-w-[calc(100vw-2rem)]" style="box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1);">
                            <div class="text-center">
                              <p class="text-gray-700 dark:text-gray-200">
                                Japanese TV broadcast time (in local time). Streaming services usually release with 3 hours after show ends.
                              </p>
                            </div>
                            <div class="absolute top-full right-4 border-8 border-transparent border-t-white dark:border-t-gray-900"></div>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/if}

          <div class="flex flex-col lg:flex-row gap-8">
            <!-- Details Panel -->
            <div class="bg-white dark:bg-gray-800 p-4 rounded-md shadow-md text-sm text-gray-800 dark:text-gray-200 space-y-6 w-full lg:max-w-xs transition-colors duration-300">
              <div class="space-y-3">
                <h2 class="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">Titles</h2>
                {#if renderField("Japanese", anime.titleJp)}
                  {@const field = renderField("Japanese", anime.titleJp)}
                  <div>
                    <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">{field.label}</h3>
                    <p class="text-gray-700 dark:text-gray-300">{field.value}</p>
                  </div>
                {/if}
                {#if renderField("Romaji", anime.titleRomaji)}
                  {@const field = renderField("Romaji", anime.titleRomaji)}
                  <div>
                    <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">{field.label}</h3>
                    <p class="text-gray-700 dark:text-gray-300">{field.value}</p>
                  </div>
                {/if}
                {#if renderField("Kanji", anime.titleKanji)}
                  {@const field = renderField("Kanji", anime.titleKanji)}
                  <div>
                    <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">{field.label}</h3>
                    <p class="text-gray-700 dark:text-gray-300">{field.value}</p>
                  </div>
                {/if}
                {#if anime.titleSynonyms && anime.titleSynonyms.length > 0}
                  <div>
                    <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">Synonyms</h3>
                    <p class="text-gray-700 dark:text-gray-300">{anime.titleSynonyms.join(", ")}</p>
                  </div>
                {/if}
              </div>

              <div class="space-y-3">
                <h2 class="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">Production</h2>
                {#if renderField("Studios", anime.studios)}
                  {@const field = renderField("Studios", anime.studios)}
                  <div>
                    <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">{field.label}</h3>
                    {#if Array.isArray(field.value)}
                      <ul class="list-disc pl-5">
                        {#each field.value as item}
                          <li class="text-gray-700 dark:text-gray-300">{item}</li>
                        {/each}
                      </ul>
                    {:else}
                      <p class="text-gray-700 dark:text-gray-300">{field.value}</p>
                    {/if}
                  </div>
                {/if}
                {#if renderField("Source", anime.source)}
                  {@const field = renderField("Source", anime.source)}
                  <div>
                    <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">{field.label}</h3>
                    <p class="text-gray-700 dark:text-gray-300">{field.value}</p>
                  </div>
                {/if}
                {#if renderField("Licensors", anime.licensors)}
                  {@const field = renderField("Licensors", anime.licensors)}
                  <div>
                    <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">{field.label}</h3>
                    {#if Array.isArray(field.value)}
                      <ul class="list-disc pl-5">
                        {#each field.value as item}
                          <li class="text-gray-700 dark:text-gray-300">{item}</li>
                        {/each}
                      </ul>
                    {:else}
                      <p class="text-gray-700 dark:text-gray-300">{field.value}</p>
                    {/if}
                  </div>
                {/if}
              </div>

              <div class="space-y-3">
                <h2 class="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">Ranking/Rating</h2>
                {#if renderField("Rating", anime.rating)}
                  {@const field = renderField("Rating", anime.rating)}
                  <div>
                    <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">{field.label}</h3>
                    <p class="text-gray-700 dark:text-gray-300">{field.value}</p>
                  </div>
                {/if}
                {#if renderField("Ranking", anime.ranking?.toString())}
                  {@const field = renderField("Ranking", anime.ranking?.toString())}
                  <div>
                    <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">{field.label}</h3>
                    <p class="text-gray-700 dark:text-gray-300">{field.value}</p>
                  </div>
                {/if}
              </div>

              <div class="space-y-3">
                <h2 class="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">Other Info</h2>
                {#if renderField("Broadcast", anime.broadcast || "Unknown")}
                  {@const field = renderField("Broadcast", anime.broadcast || "Unknown")}
                  <div>
                    <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">{field.label}</h3>
                    <p class="text-gray-700 dark:text-gray-300">{field.value}</p>
                  </div>
                {/if}
              </div>

              <div class="space-y-3">
                <h2 class="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">Aired</h2>
                {#if renderField("Start Date", anime.startDate ? format(new Date(anime.startDate), "dd MMM yyyy") : "Unknown")}
                  {@const field = renderField("Start Date", anime.startDate ? format(new Date(anime.startDate), "dd MMM yyyy") : "Unknown")}
                  <div>
                    <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">{field.label}</h3>
                    <p class="text-gray-700 dark:text-gray-300">{field.value}</p>
                  </div>
                {/if}
                {#if renderField("End Date", anime.endDate ? format(new Date(anime.endDate), "dd MMM yyyy") : "Ongoing")}
                  {@const field = renderField("End Date", anime.endDate ? format(new Date(anime.endDate), "dd MMM yyyy") : "Ongoing")}
                  <div>
                    <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">{field.label}</h3>
                    <p class="text-gray-700 dark:text-gray-300">{field.value}</p>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Tabs Section -->
            <div class="w-full">
              <Tabs tabs={["Episodes", "Characters", "Trailers", "Artworks"]} defaultTab="Episodes">
                <div slot="Episodes">
                  {#if anime.episodes}
                    <Episodes episodes={anime.episodes} broadcast={anime.broadcast} />
                  {/if}
                </div>
                <div slot="Characters">
                  <CharactersWithStaff animeId={anime.id} ssrCharactersData={charactersData} />
                </div>
                <div slot="Trailers">
                  <!-- TODO: Add Trailers component -->
                </div>
                <div slot="Artworks">
                  <!-- TODO: Add Artworks component -->
                </div>
              </Tabs>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex justify-end mt-8">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {anime.updatedAt ? format(new Date(anime.updatedAt), "dd MMM yyyy") : "Unknown"}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}