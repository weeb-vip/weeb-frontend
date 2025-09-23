<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { format } from 'date-fns';
  import { onMount } from 'svelte';
  import AnimeCard from './AnimeCard.svelte';
  import AnimeCardSkeleton from './AnimeCardSkeleton.svelte';
  import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
  import Button from './Button.svelte';
  import CurrentlyAiringCard from './CurrentlyAiringCard.svelte';
  import HeroBanner from './HeroBanner.svelte';
  import HeroBannerSkeleton from './HeroBannerSkeleton.svelte';
  import { initializeQueryClient } from '../services/query-client';
  import {
    fetchHomePageData,
    fetchSeasonalAnime,
    fetchCurrentlyAiring
  } from '../../services/queries';
  import { useAddAnimeWithToast, useDeleteAnimeWithToast } from '../utils/anime-actions';
  import { GetImageFromAnime } from '../../services/utils';
  import { findNextEpisode, getAirTimeDisplay } from '../../services/airTimeUtils';
  import { toast } from 'svelte-sonner';
  import { animeToast } from '../utils/animeToast';
  import { animeNotificationService } from '../../services/animeNotifications';
  import '@fortawesome/fontawesome-free/css/all.min.css';

  let selectedSeason = getCurrentSeason();
  let isDropdownOpen = false;
  let animeStatuses: Record<string, 'idle' | 'loading' | 'success' | 'error'> = {};

  // Initialize query client
  const queryClient = initializeQueryClient();

  // Season utilities
  function getCurrentSeason(): string {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    if (month >= 0 && month <= 2) return `WINTER_${year}`;
    if (month >= 3 && month <= 5) return `SPRING_${year}`;
    if (month >= 6 && month <= 8) return `SUMMER_${year}`;
    return `FALL_${year}`;
  }

  function getSeasonOptions(currentSeason: string): string[] {
    // Show current season plus next 2 seasons (same as React component)
    const [season, yearStr] = currentSeason.split('_');
    let year = parseInt(yearStr);
    const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
    let currentIndex = seasons.indexOf(season);

    const options: string[] = [currentSeason];

    // Add next 2 seasons
    for (let i = 1; i <= 2; i++) {
      currentIndex++;
      if (currentIndex >= seasons.length) {
        currentIndex = 0;
        year++;
      }
      options.push(`${seasons[currentIndex]}_${year}`);
    }

    return options;
  }

  function getSeasonDisplayName(season: string): string {
    const [name, year] = season.split('_');
    return `${name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()} ${year}`;
  }

  const currentSeason = getCurrentSeason();
  const seasonOptions = getSeasonOptions(currentSeason);

  // Create TanStack Query stores
  const homeDataQuery = createQuery(fetchHomePageData(), queryClient);
  const currentlyAiringQuery = createQuery(fetchCurrentlyAiring(), queryClient);

  // Create seasonal data with manual fetching
  let seasonalData: any = null;
  let seasonalLoading = false;
  let seasonalError: any = null;
  let hoveredAnime: any = null;
  let lastHoveredAnime: any = null;

  // Function to fetch seasonal data
  async function fetchSeasonalData(season: string) {
    seasonalLoading = true;
    seasonalError = null;
    seasonalData = null;

    try {
      const queryConfig = fetchSeasonalAnime(season);
      const data = await queryConfig.queryFn();
      seasonalData = data;
    } catch (error) {
      seasonalError = error;
      console.error('Failed to fetch seasonal data:', error);
    } finally {
      seasonalLoading = false;
    }
  }

  // Initial fetch on mount
  onMount(() => {
    fetchSeasonalData(selectedSeason);

    // Notification callback is now set up globally in AnimeNotificationProvider
    // We don't need to set it up here anymore

  });

  // Watch for season changes and fetch data
  $: {
    if (typeof window !== 'undefined') {
      fetchSeasonalData(selectedSeason);
    }
  }

  // Create enhanced mutations with toast handling
  const upsertAnimeMutation = useAddAnimeWithToast();
  const deleteAnimeMutation = useDeleteAnimeWithToast();

  // Extend upsert mutation with custom status tracking callbacks
  const originalUpsertMutate = upsertAnimeMutation.mutate;
  upsertAnimeMutation.mutate = (variables, options = {}) => {
    // Update status tracking on success
    const originalOnSuccess = options.onSuccess;
    options.onSuccess = (data, vars) => {
      // Update anime status
      animeStatuses = { ...animeStatuses };
      const animeId = vars.animeID;
      Object.keys(animeStatuses).forEach(key => {
        if (key.includes(animeId)) {
          animeStatuses[key] = 'success';
        }
      });

      // Invalidate additional queries specific to homepage
      queryClient.invalidateQueries({ queryKey: ['homedata'] });

      if (originalOnSuccess) originalOnSuccess(data, vars);
    };

    // Update status tracking on error
    const originalOnError = options.onError;
    options.onError = (error, vars) => {
      // Update anime status to error
      const animeId = vars.animeID;
      animeStatuses = { ...animeStatuses };
      Object.keys(animeStatuses).forEach(key => {
        if (key.includes(animeId)) {
          animeStatuses[key] = 'error';
        }
      });
      if (originalOnError) originalOnError(error, vars);
    };

    return originalUpsertMutate(variables, options);
  };

  // Extend delete mutation with additional query invalidation
  const originalDeleteMutate = deleteAnimeMutation.mutate;
  deleteAnimeMutation.mutate = (variables, options = {}) => {
    const originalOnSuccess = options.onSuccess;
    options.onSuccess = (data, vars) => {
      // Invalidate additional queries specific to homepage
      queryClient.invalidateQueries({ queryKey: ['homedata'] });
      if (originalOnSuccess) originalOnSuccess(data, vars);
    };
    return originalDeleteMutate(variables, options);
  };

  // Process currently airing data - exactly like React component
  function processCurrentlyAiring(data: any) {
    if (!data?.currentlyAiring) return [];

    const now = new Date();
    const currentlyAiringShows = data.currentlyAiring || [];
    const processedAnime: any[] = [];

    // Process each anime and determine its next episode
    currentlyAiringShows.forEach((anime: any) => {
      if (!anime || !(anime as any).episodes || (anime as any).episodes.length === 0) return;

      const episodes = (anime as any).episodes;

      // Use shared function to find the next episode
      const nextEpisodeResult = findNextEpisode(episodes, anime.broadcast, now);

      // If we found a next episode, add this anime to our list
      if (nextEpisodeResult) {
        const { episode: nextEpisode, airTime: nextEpisodeAirTime } = nextEpisodeResult;
        // Generate air time display info (using local timezone formatting)
        const airTimeInfo = getAirTimeDisplay(nextEpisode.airDate, anime.broadcast) || {
          show: true,
          text: nextEpisodeAirTime <= now
            ? "Recently aired"
            : `Airing ${format(nextEpisodeAirTime, "EEE")} at ${format(nextEpisodeAirTime, "h:mm a")}`,
          variant: nextEpisodeAirTime <= now ? 'aired' as const : 'scheduled' as const
        };

        const processedEntry = {
          id: `homepage-${anime.id}`,
          anime: {
            id: anime.id,
            titleEn: anime.titleEn,
            titleJp: anime.titleJp,
            description: null,
            episodeCount: null,
            duration: anime.duration,
            startDate: anime.startDate,
            imageUrl: anime.imageUrl,
            userAnime: anime.userAnime || null
          },
          status: null,
          airingInfo: {
            ...anime,
            airTimeDisplay: airTimeInfo,
            nextEpisodeDate: nextEpisodeAirTime,
            nextEpisode: {
              ...nextEpisode,
              airDate: nextEpisodeAirTime
            },
            isInWatchlist: false
          }
        };

        processedAnime.push(processedEntry);
      }
    });

    // Filter and sort anime: only recently aired (last 30 minutes) or future episodes
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Separate recently aired and future episodes
    const recentlyAired = processedAnime
      .filter(anime => {
        const airTime = anime.airingInfo.nextEpisodeDate;
        return airTime <= now && airTime >= thirtyMinutesAgo;
      })
      .sort((a, b) => b.airingInfo.nextEpisodeDate.getTime() - a.airingInfo.nextEpisodeDate.getTime()) // Most recent first
      .slice(0, 2); // Limit to 2 recently aired shows

    const futureEpisodes = processedAnime
      .filter(anime => anime.airingInfo.nextEpisodeDate > now)
      .sort((a, b) => a.airingInfo.nextEpisodeDate.getTime() - b.airingInfo.nextEpisodeDate.getTime()); // Earliest first

    // Combine: recently aired first, then future episodes
    return [...recentlyAired, ...futureEpisodes];
  }

  function handleStatusChange(event: CustomEvent) {
    const { animeId, status } = event.detail;
    $upsertAnimeMutation.mutate({ input: { animeID: animeId, status } });
  }

  function handleDelete(event: CustomEvent) {
    console.log('🗑️ handleDelete called with:', event.detail);
    const { animeId } = event.detail;
    console.log('🗑️ Calling deleteAnimeMutation with animeId:', animeId);
    $deleteAnimeMutation.mutate(animeId);
  }

  function clearAnimeStatus(animeId: string) {
    console.log('🧹 clearAnimeStatus called with animeId:', animeId);
    // Call the delete mutation first
    console.log('🗑️ Calling deleteAnimeMutation from clearAnimeStatus with animeId:', animeId);
    $deleteAnimeMutation.mutate(animeId);

    // Clear status for all keys that contain this animeId
    const updated = { ...animeStatuses };
    Object.keys(updated).forEach(key => {
      if (key.includes(animeId)) {
        delete updated[key];
      }
    });
    animeStatuses = updated;
  }

  function handleAddAnime(id: string, animeId: string) {
    animeStatuses[id] = 'loading';
    $upsertAnimeMutation.mutate({ input: { animeID: animeId, status: 'PLANTOWATCH' } });
  }

  // Reactive data using TanStack Query stores
  $: sortedCurrentlyAiring = processCurrentlyAiring($currentlyAiringQuery.data);
  $: homeData = $homeDataQuery.data;

  // Set up anime notifications when currently airing data is available
  $: if ($currentlyAiringQuery.isSuccess && $currentlyAiringQuery.data?.currentlyAiring) {
    // Convert currently airing data to notification format (like React)
    const animeForNotifications = $currentlyAiringQuery.data.currentlyAiring.map(anime => ({
      id: anime.id,
      titleEn: anime.titleEn,
      titleJp: anime.titleJp,
      imageUrl: anime.imageUrl,
      duration: anime.duration,
      broadcast: anime.broadcast,
      episodes: anime.episodes
    }));

    // Notifications are now managed globally by AnimeNotificationProvider
    // Just trigger an update to refresh the data for the hero banner
    setTimeout(() => {
      animeNotificationService.triggerImmediateUpdate();
    }, 50);
  }

  // Track the last hovered anime to keep it sticky
  $: if (hoveredAnime) {
    lastHoveredAnime = hoveredAnime;
  }

  // Determine which anime to show in banner (use hovered anime, last hovered, or fallback to first)
  $: bannerAnime = hoveredAnime || lastHoveredAnime || (sortedCurrentlyAiring[0]?.airingInfo);

  // Remove debug logging
</script>

<div class="flex flex-col max-w-screen-2xl px-4 lg:px-0" style="margin: 0 auto">

  <!-- Hero Banner Section -->
  {#if $currentlyAiringQuery.isLoading || sortedCurrentlyAiring.length > 0}
    <div class="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] md:w-full md:left-auto md:right-auto md:ml-0 md:mr-0 h-[600px] sm:h-[650px] md:h-[700px] md:mt-8 mb-8 md:mx-0 md:rounded-lg md:shadow-xl bg-gray-200 dark:bg-gray-800">
      {#if bannerAnime && !$currentlyAiringQuery.isLoading}
        {#key bannerAnime.id}
          <HeroBanner
            anime={bannerAnime}
            onAddAnime={(animeId) => handleAddAnime(`hero-${animeId}`, animeId)}
            animeStatus={animeStatuses[`hero-${bannerAnime.id}`] || 'idle'}
            onDeleteAnime={clearAnimeStatus}
          />
        {/key}
      {:else}
        <HeroBannerSkeleton />
      {/if}
    </div>
  {/if}

  <!-- Currently Airing Section -->
  <div class="w-full flex flex-col mb-12">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Currently Airing Anime</h1>
      <a href="/airing" class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors duration-200">
        See all →
      </a>
    </div>



    {#if $currentlyAiringQuery.isLoading}
      <div class="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
        {#each Array(8) as _, index}
          {#if index < 5}
            <AnimeCardSkeleton style="detail" />
          {:else}
            <div class="hidden xl:block">
              <AnimeCardSkeleton style="detail" />
            </div>
          {/if}
        {/each}
      </div>
    {:else}
      <div class="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
        {#each sortedCurrentlyAiring.slice(0, 8) as entry, index}
          <CurrentlyAiringCard
            {entry}
            {index}
            {animeStatuses}
            {handleAddAnime}
            {hoveredAnime}
            setHoveredAnime={(anime) => hoveredAnime = anime}
            onDelete={clearAnimeStatus}
            onStatusChange={handleStatusChange}
          />
        {/each}
      </div>
    {/if}
  </div>

  <!-- Seasonal Anime Section -->
  <div class="w-full flex flex-col mb-12">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{getSeasonDisplayName(selectedSeason)} Anime</h1>

      <!-- Desktop: Button layout -->
      <div class="hidden sm:flex gap-2">
        {#each seasonOptions as season}
          <button
            on:click={() => selectedSeason = season}
            class="px-3 py-1 rounded text-sm font-medium transition-colors duration-200 {selectedSeason === season
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }"
          >
            {getSeasonDisplayName(season)}
          </button>
        {/each}
      </div>

      <!-- Mobile: Dropdown layout -->
      <div class="sm:hidden relative">
        <button
          on:click={() => isDropdownOpen = !isDropdownOpen}
          class="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-gray-900 dark:text-gray-100 font-medium text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 text-sm"
        >
          <span class="truncate">{getSeasonDisplayName(selectedSeason)}</span>
          <i class="fas fa-chevron-down w-3 h-3 ml-2 flex-shrink-0 transition-transform duration-200 {isDropdownOpen ? 'rotate-180' : ''}"></i>
        </button>

        {#if isDropdownOpen}
          <!-- Backdrop -->
          <div
            class="fixed inset-0 z-10"
            on:click={() => isDropdownOpen = false}
          />

          <!-- Dropdown menu -->
          <div class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20 py-1">
            {#each seasonOptions as season}
              <button
                on:click={() => {
                  selectedSeason = season;
                  isDropdownOpen = false;
                }}
                class="w-full text-left px-3 py-2 text-sm transition-colors duration-200 {selectedSeason === season
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
                }"
              >
                {getSeasonDisplayName(season)}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    {#if seasonalLoading}
      <div class="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
        {#each Array(8) as _, index}
          {#if index < 5}
            <AnimeCardSkeleton style="detail" />
          {:else}
            <div class="hidden xl:block">
              <AnimeCardSkeleton style="detail" />
            </div>
          {/if}
        {/each}
      </div>
    {:else if seasonalData && seasonalData.animeBySeasons}
      <div class="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
        {#each seasonalData.animeBySeasons.sort((a, b) => {
          const getRating = (rating) => {
            if (!rating || rating === 'N/A') return 0;
            const parsed = parseFloat(rating);
            return isNaN(parsed) ? 0 : parsed;
          };
          const ratingA = getRating(a.rating);
          const ratingB = getRating(b.rating);
          return ratingB - ratingA;
        }).slice(0, 8) as anime, index}
          <div class="{index >= 5 ? 'lg:hidden xl:block' : ''}">
            <AnimeCard
            style="detail"
            id={anime.id}
            title={anime.titleEn || anime.titleJp || "Unknown"}
            description=""
            episodes={Math.max(anime.episodeCount || 0, anime.episodes?.length || 0)}
            episodeLength={anime.duration ? anime.duration.replace(/per.+?$|per/gm, '') : "?"}
            year={anime.startDate ? format(new Date(anime.startDate.toString()), "yyyy") : "?"}
            image={GetImageFromAnime(anime)}
            entry={anime.userAnime}
          >
            <div slot="options">
              {#if !anime.userAnime}
                <Button
                  color="blue"
                  label="Add to list"
                  showLabel={true}
                  status={animeStatuses[`${selectedSeason.toLowerCase()}-${anime.id}`] || 'idle'}
                  className="w-fit px-2 py-1 text-xs"
                  onClick={() => handleAddAnime(`${selectedSeason.toLowerCase()}-${anime.id}`, anime.id)}
                />
              {:else}
                <AnimeStatusDropdown
                  entry={{
                    ...anime.userAnime,
                    anime
                  }}
                  variant="compact"
                  on:statusChange={handleStatusChange}
                  on:delete={handleDelete}
                />
              {/if}
            </div>
          </AnimeCard>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Top Rated Anime Section -->
  <div class="w-full flex flex-col">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Top Rated Anime</h1>
    </div>

    {#if $homeDataQuery.isLoading}
      <div class="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
        {#each Array(8) as _, index}
          {#if index < 5}
            <AnimeCardSkeleton style="detail" />
          {:else}
            <div class="hidden xl:block">
              <AnimeCardSkeleton style="detail" />
            </div>
          {/if}
        {/each}
      </div>
    {:else if homeData && homeData.topRatedAnime}
      <div class="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
        {#each homeData.topRatedAnime.slice(0, 8) as anime, index}
          <div class="{index >= 5 ? 'lg:hidden xl:block' : ''}">
            <AnimeCard
              style="detail"
              id={anime.id}
              title={anime.titleEn || anime.titleJp || "Unknown"}
              description=""
              episodes={Math.max(anime.episodeCount || 0, anime.episodes?.length || 0)}
              episodeLength={anime.duration ? anime.duration.replace(/per.+?$|per/gm, '') : "?"}
              year={anime.startDate ? format(new Date(anime.startDate.toString()), "yyyy") : "?"}
              image={GetImageFromAnime(anime)}
              entry={anime.userAnime}
            >
              <div slot="options">
                {#if !anime.userAnime}
                  <Button
                    color="blue"
                    label="Add to list"
                    showLabel={true}
                    status={animeStatuses[`top-rated-${anime.id}`] || 'idle'}
                    className="w-fit px-2 py-1 text-xs"
                    onClick={() => handleAddAnime(`top-rated-${anime.id}`, anime.id)}
                  />
                {:else}
                  <AnimeStatusDropdown
                    entry={{
                      ...anime.userAnime,
                      anime
                    }}
                    variant="compact"
                    on:statusChange={handleStatusChange}
                    on:delete={handleDelete}
                  />
                {/if}
              </div>
            </AnimeCard>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Newest Anime Section -->
  <div class="w-full flex flex-col">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Newest Anime</h1>
    </div>

    {#if $homeDataQuery.isLoading}
      <div class="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
        {#each Array(8) as _, index}
          {#if index < 5}
            <AnimeCardSkeleton style="detail" />
          {:else}
            <div class="hidden xl:block">
              <AnimeCardSkeleton style="detail" />
            </div>
          {/if}
        {/each}
      </div>
    {:else if homeData && homeData.newestAnime}
      <div class="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
        {#each homeData.newestAnime.slice(0, 8) as anime, index}
          <div class="{index >= 5 ? 'lg:hidden xl:block' : ''}">
            <AnimeCard
              style="detail"
              id={anime.id}
              title={anime.titleEn || anime.titleJp || "Unknown"}
              description=""
              episodes={Math.max(anime.episodeCount || 0, anime.episodes?.length || 0)}
              episodeLength={anime.duration ? anime.duration.replace(/per.+?$|per/gm, '') : "?"}
              year={anime.startDate ? format(new Date(anime.startDate.toString()), "yyyy") : "?"}
              image={GetImageFromAnime(anime)}
              entry={anime.userAnime}
            >
              <div slot="options">
                {#if !anime.userAnime}
                  <Button
                    color="blue"
                    label="Add to list"
                    showLabel={true}
                    status={animeStatuses[`newest-anime-${anime.id}`] || 'idle'}
                    className="w-fit px-2 py-1 text-xs"
                    onClick={() => handleAddAnime(`newest-anime-${anime.id}`, anime.id)}
                  />
                {:else}
                  <AnimeStatusDropdown
                    entry={{
                      ...anime.userAnime,
                      anime
                    }}
                    variant="compact"
                    on:statusChange={handleStatusChange}
                    on:delete={handleDelete}
                  />
                {/if}
              </div>
            </AnimeCard>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
