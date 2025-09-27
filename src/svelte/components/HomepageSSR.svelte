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
    fetchCurrentlyAiring,
    fetchSeasonalAnime
  } from '../../services/queries';
  import { useAddAnimeWithToast, useDeleteAnimeWithToast } from '../utils/anime-actions';
  import { GetImageFromAnime } from '../../services/utils';
  import { findNextEpisode, getAirTimeDisplay } from '../../services/airTimeUtils';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';
  import { animeNotificationService } from '../../services/animeNotifications';
  import { AuthStorage } from '../../utils/auth-storage';
  import { loggedInStore } from '../stores/auth';
  import { fade, fly, crossfade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  const [send, receive] = crossfade({
    duration: 200,
    easing: quintOut
  });
  import '@fortawesome/fontawesome-free/css/all.min.css';

  // SSR props
  export let auth: any;
  export let homeData: any;
  export let currentlyAiringData: any;
  export let seasonalData: any;
  export let currentSeason: string;
  export let ssrError: string | null;
  export let isTokenExpired: boolean = false;

  let selectedSeason = currentSeason;
  let isDropdownOpen = false;
  let animeStatuses: Record<string, 'idle' | 'loading' | 'success' | 'error'> = {};

  // Initialize query client for mutations only
  const queryClient = initializeQueryClient();

  // Season utilities
  function getSeasonOptions(currentSeason: string): string[] {
    const [season, yearStr] = currentSeason.split('_');
    let year = parseInt(yearStr);
    const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
    let currentIndex = seasons.indexOf(season);

    const options: string[] = [currentSeason];

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

  const seasonOptions = getSeasonOptions(currentSeason);

  // Variables for tracking state
  let hoveredAnime: any = null;
  let lastHoveredAnime: any = null;

  // Create all data queries that refresh on login state changes
  const homeDataQuery = createQuery({
    ...fetchHomePageData(),
    initialData: homeData,
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't auto-refetch on mount since we have SSR data
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnReconnect: false // Don't refetch when reconnecting
  }, queryClient);

  const currentlyAiringQuery = createQuery({
    ...fetchCurrentlyAiring(),
    initialData: currentlyAiringData,
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't auto-refetch on mount since we have SSR data
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes (more dynamic)
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnReconnect: false // Don't refetch when reconnecting
  }, queryClient);

  // Create seasonal anime query for dynamic season changes
  $: seasonalAnimeQuery = createQuery({
    ...fetchSeasonalAnime(selectedSeason),
    enabled: selectedSeason !== currentSeason, // Only fetch if different from SSR season
    initialData: selectedSeason === currentSeason ? seasonalData : undefined,
    refetchOnWindowFocus: false,
    staleTime: 10 * 60 * 1000, // Consider data fresh for 10 minutes (seasonal data changes slowly)
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnReconnect: false
  }, queryClient);

  // Track login state for refetching data
  let previousLoginState: boolean | null = null;

  // Svelte store is already imported and ready to use

  // Handle initialization and login state changes
  onMount(() => {
    // Handle token expiration on client side
    if (isTokenExpired) {
      console.log('🔓 Token expired detected on client - clearing local storage');
      // Clear any client-side auth state
      AuthStorage.clearTokens();

      // Update logged in state if available
      if (typeof window !== 'undefined' && window.localStorage) {
        const store = JSON.parse(localStorage.getItem('logged-in-store') || '{}');
        if (store?.state) {
          store.state.isLoggedIn = false;
          store.state.authInitialized = true;
          localStorage.setItem('logged-in-store', JSON.stringify(store));
        }
      }
    }

    // Set initial auth token state for comparison
    let lastAuthToken = AuthStorage.getAuthToken();
    const refreshToken = AuthStorage.getRefreshToken();
    console.log('🔧 Initial auth token:', lastAuthToken ? 'Present' : 'Missing');
    console.log('🔧 Initial refresh token:', refreshToken ? 'Present' : 'Missing');

    // If auth token is missing but refresh token exists, attempt to refresh
    if (!lastAuthToken && refreshToken) {
      console.log('🔄 Auth token missing but refresh token available, attempting refresh...');
      import('../../services/token_refresher').then(({ TokenRefresher }) => {
        import('../../services/queries').then(({ refreshTokenSimple }) => {
          TokenRefresher.getInstance(refreshTokenSimple);
        });
      });
    }

    // Watch for login state changes using Zustand subscription
    const unsubscribe = loggedInStore.subscribe((state) => {
      console.log('🔍 Login state update:', {
        current: state.isLoggedIn,
        previous: previousLoginState,
        isAuthInitialized: state.isAuthInitialized
      });

      if (previousLoginState !== null && previousLoginState !== state.isLoggedIn && state.isAuthInitialized) {
        console.log('🔄 Login state changed from', previousLoginState, 'to', state.isLoggedIn, '- refetching all data');

        refreshAllData();

        // Update previous state
        previousLoginState = state.isLoggedIn;
      } else if (previousLoginState === null && state.isAuthInitialized) {
        // Initialize previous state once auth is ready
        previousLoginState = state.isLoggedIn;
        console.log('🔧 Initialized previous login state to:', previousLoginState);
      }
    });

    // Also watch for direct cookie/token changes (fallback method)
    // Use a longer interval to reduce performance impact
    const tokenCheckInterval = setInterval(() => {
      const currentAuthToken = AuthStorage.getAuthToken();
      const hadToken = !!lastAuthToken;
      const hasToken = !!currentAuthToken;

      if (hadToken !== hasToken) {
        console.log('🍪 Auth token state changed:', {
          had: hadToken,
          has: hasToken,
          action: hasToken ? 'LOGIN' : 'LOGOUT'
        });

        // Force refetch all queries when token changes
        refreshAllData();

        lastAuthToken = currentAuthToken;
      }
    }, 5000); // Check every 5 seconds instead of 1 second

    // Listen for custom login success events
    const handleLoginSuccess = () => {
      console.log('🎉 Login success event received - refreshing homepage data');
      refreshAllData();
    };

    // Listen for custom events from login modal
    window.addEventListener('loginSuccess', handleLoginSuccess);
    window.addEventListener('authStateChanged', handleLoginSuccess);

    // Expose refresh function globally for debugging/integration
    window.refreshHomepageData = refreshAllData;

    // Background prefetch next two seasons for instant switching
    if (seasonOptions.length > 1) {
      // Use setTimeout to ensure this runs after page has fully loaded
      setTimeout(() => {
        console.log('🚀 Background prefetching next seasons:', seasonOptions.slice(1));

        // Prefetch the next two seasons quietly in background
        seasonOptions.slice(1).forEach(season => {
          queryClient.prefetchQuery({
            ...fetchSeasonalAnime(season),
            staleTime: 10 * 60 * 1000, // Keep fresh for 10 minutes
            gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
          });
        });
      }, 2000); // Wait 2 seconds after component mount
    }

    return () => {
      unsubscribe();
      clearInterval(tokenCheckInterval);
      window.removeEventListener('loginSuccess', handleLoginSuccess);
      window.removeEventListener('authStateChanged', handleLoginSuccess);
      delete window.refreshHomepageData;
    };
  });

  // Create mutations with success callbacks
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
      Object.keys(animeStatuses).forEach(key => {
        if (key.includes(vars.animeID)) {
          animeStatuses[key] = 'success';
        }
      });
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

  // Process currently airing data
  function processCurrentlyAiring(data: any) {
    if (!data?.currentlyAiring) return [];

    const now = new Date();
    const currentlyAiringShows = data.currentlyAiring || [];
    const processedAnime: any[] = [];

    currentlyAiringShows.forEach((anime: any) => {
      if (!anime || !anime.nextEpisode) return;

      const nextEpisode = anime.nextEpisode;

      // Skip anime where nextEpisode has null airdate or airTime
      if (!nextEpisode.airDate && !nextEpisode.airTime) return;

      // Use airTime from backend if available, otherwise fall back to airDate
      const nextEpisodeAirTime = nextEpisode.airTime ? new Date(nextEpisode.airTime) : new Date(nextEpisode.airDate);

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
    });

    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    const recentlyAired = processedAnime
      .filter(anime => {
        const airTime = anime.airingInfo.nextEpisodeDate;
        return airTime <= now && airTime >= thirtyMinutesAgo;
      })
      .sort((a, b) => b.airingInfo.nextEpisodeDate.getTime() - a.airingInfo.nextEpisodeDate.getTime())
      .slice(0, 2);

    const futureEpisodes = processedAnime
      .filter(anime => anime.airingInfo.nextEpisodeDate > now)
      .sort((a, b) => a.airingInfo.nextEpisodeDate.getTime() - b.airingInfo.nextEpisodeDate.getTime());

    return [...recentlyAired, ...futureEpisodes];
  }

  function handleStatusChange(event: CustomEvent) {
    const { animeId, status } = event.detail;
    $upsertAnimeMutation.mutate({ input: { animeID: animeId, status } });
  }

  function handleDelete(event: CustomEvent) {
    const { animeId } = event.detail;
    $deleteAnimeMutation.mutate(animeId);
  }

  function clearAnimeStatus(animeId: string) {
    $deleteAnimeMutation.mutate(animeId);
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

  // Process currently airing data from queries (with SSR fallback)
  $: sortedCurrentlyAiring = processCurrentlyAiring($currentlyAiringQuery.data || currentlyAiringData);

  // Get current seasonal data - use query data when available, SSR data as fallback
  $: currentSeasonalData = selectedSeason === currentSeason
    ? ($seasonalAnimeQuery.data || seasonalData)
    : $seasonalAnimeQuery.data;

  // Set up anime notifications when currently airing data is available
  $: if (currentlyAiringData?.currentlyAiring) {
    const animeForNotifications = currentlyAiringData.currentlyAiring.map(anime => ({
      id: anime.id,
      titleEn: anime.titleEn,
      titleJp: anime.titleJp,
      imageUrl: anime.imageUrl,
      duration: anime.duration,
      broadcast: anime.broadcast,
      episodes: anime.episodes
    }));

    setTimeout(() => {
      animeNotificationService.triggerImmediateUpdate();
    }, 50);
  }

  // Track the last hovered anime to keep it sticky
  $: if (hoveredAnime) {
    lastHoveredAnime = hoveredAnime;
  }

  // Determine which anime to show in banner
  $: bannerAnime = hoveredAnime || lastHoveredAnime || (sortedCurrentlyAiring[0]?.airingInfo);

  // Function to refresh all data
  function refreshAllData() {
    console.log('🔄 Refreshing all homepage data...');

    // Force refetch all queries
    console.log('🔄 Refetching homedata query...');
    queryClient.refetchQueries({ queryKey: ['homedata'] }).then(() => {
      console.log('✅ Homedata refetch completed');
    });

    console.log('🔄 Refetching currently-airing query...');
    queryClient.refetchQueries({ queryKey: ['currently-airing'] }).then(() => {
      console.log('✅ Currently-airing refetch completed');
    });

    console.log('🔄 Refetching seasonal-anime query...');
    queryClient.refetchQueries({ queryKey: ['seasonal-anime'] }).then(() => {
      console.log('✅ Seasonal-anime refetch completed');
    });
  }
</script>

<div class="flex flex-col max-w-screen-2xl px-4 lg:px-0" style="margin: 0 auto">


  <!-- Hero Banner Section -->
  {#if sortedCurrentlyAiring.length > 0}
    <div class="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] md:w-full md:left-auto md:right-auto md:ml-0 md:mr-0 h-[600px] sm:h-[650px] md:h-[700px] md:mt-8 mb-8 md:mx-0 md:rounded-lg md:shadow-xl bg-gray-200 dark:bg-gray-800">
      {#if bannerAnime}
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
            class="px-3 py-1 rounded text-sm font-medium transition-all duration-200 transform hover:scale-105 {selectedSeason === season
              ? 'bg-blue-600 text-white shadow-lg'
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
          <div
            class="fixed inset-0 z-10"
            on:click={() => isDropdownOpen = false}
          />

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

    <!-- Seasonal content with stable container -->
    <div class="relative overflow-hidden">
      <!-- Fixed grid container to prevent layout shifts -->
      <div class="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center min-h-[400px]">

        {#if $seasonalAnimeQuery.isLoading && selectedSeason !== currentSeason}
          <!-- Loading skeleton overlay -->
          {#each Array(8) as _, index}
            <div
              class="{index >= 5 ? 'lg:hidden xl:block' : ''}"
              in:fade={{ duration: 150 }}
              out:fade={{ duration: 100 }}
            >
              <AnimeCardSkeleton style="detail" />
            </div>
          {/each}
        {:else if currentSeasonalData && currentSeasonalData.animeBySeasons}
          <!-- Actual content -->
          {#each currentSeasonalData.animeBySeasons.sort((a, b) => {
            const getRating = (rating) => {
              if (!rating || rating === 'N/A') return 0;
              const parsed = parseFloat(rating);
              return isNaN(parsed) ? 0 : parsed;
            };
            const ratingA = getRating(a.rating);
            const ratingB = getRating(b.rating);
            return ratingB - ratingA;
          }).slice(0, 8) as anime, index (anime.id)}
            <div
              class="{index >= 5 ? 'lg:hidden xl:block' : ''}"
              in:fly={{ y: 15, duration: 200, delay: 50 + (index * 30) }}
              out:send={{ key: anime.id }}
            >
              <AnimeCard
              style="detail"
              id={anime.id}
              title={getAnimeTitle(anime, $preferencesStore.titleLanguage)}
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
        {/if}
      </div>
    </div>
  </div>

  <!-- Top Rated Anime Section -->
  <div class="w-full flex flex-col">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Top Rated Anime</h1>
    </div>

    {#if ($homeDataQuery.data || homeData) && ($homeDataQuery.data || homeData).topRatedAnime}
      <div class="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
        {#each ($homeDataQuery.data || homeData).topRatedAnime.slice(0, 8) as anime, index}
          <div class="{index >= 5 ? 'lg:hidden xl:block' : ''}">
            <AnimeCard
              style="detail"
              id={anime.id}
              title={getAnimeTitle(anime, $preferencesStore.titleLanguage)}
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

    {#if ($homeDataQuery.data || homeData) && ($homeDataQuery.data || homeData).newestAnime}
      <div class="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
        {#each ($homeDataQuery.data || homeData).newestAnime.slice(0, 8) as anime, index}
          <div class="{index >= 5 ? 'lg:hidden xl:block' : ''}">
            <AnimeCard
              style="detail"
              id={anime.id}
              title={getAnimeTitle(anime, $preferencesStore.titleLanguage)}
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