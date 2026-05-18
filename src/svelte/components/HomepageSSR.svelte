<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { format } from 'date-fns';
  import { onMount } from 'svelte';
  import HeroBanner from './HeroBanner.svelte';
  import HeroBannerSkeleton from './HeroBannerSkeleton.svelte';
  import PosterCard from './PosterCard.svelte';
  import AiringStripCard from './AiringStripCard.svelte';
  import SectionHeader from './SectionHeader.svelte';
  import GenrePills from './GenrePills.svelte';
  import { initializeQueryClient } from '../services/query-client';
  import {
    fetchHomePageData,
    fetchCurrentlyAiring,
    fetchSeasonalAnime, fetchCurrentlyAiringWithDates
  } from '../../services/queries';
  import { useAddAnimeWithToast, useDeleteAnimeWithToast } from '../utils/anime-actions';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';
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
  export let homeData: any;
  export let currentlyAiringData: any;
  export let seasonalData: any;
  export let currentSeason: string;
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

  // Create all data queries that refresh on login state changes and cache invalidation
  const homeDataQuery = createQuery({
    ...fetchHomePageData(),
    initialData: homeData,
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Enable refetch on mount to respond to cache invalidation
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnReconnect: false // Don't refetch when reconnecting
  }, queryClient);

  const startDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
  const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  console.log('🔍 Date range for query:', startDate.toISOString(), 'to', endDate.toISOString());

  const currentlyAiringQuery = createQuery({
    ...fetchCurrentlyAiringWithDates(
      // current time in UTC
            startDate,
      null, 7, 10
    ),
    initialData: currentlyAiringData,
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Enable refetch on mount to respond to cache invalidation
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes (more dynamic)
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnReconnect: false // Don't refetch when reconnecting
  }, queryClient);

  // Create seasonal anime query for dynamic season changes
  $: seasonalAnimeQuery = createQuery({
    ...fetchSeasonalAnime(selectedSeason, 14),
    enabled: true, // Always enable to respond to cache invalidation
    initialData: selectedSeason === currentSeason ? seasonalData : undefined,
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Enable refetch on mount to respond to cache invalidation
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
            : `Airing ${format(nextEpisodeAirTime, "EEE MMM do")} at ${format(nextEpisodeAirTime, "h:mm a")}`,
          variant: nextEpisodeAirTime <= now ? 'aired' as const : 'scheduled' as const
        };

      const processedEntry = {
        id: `homepage-${anime.id}`,
        anime: {
          id: anime.id,
          titleEn: anime.titleEn,
          titleJp: anime.titleJp,
          description: anime.description || null,
          tags: anime.tags || [],
          episodeCount: (anime as any).episodeCount || null,
          duration: anime.duration,
          startDate: anime.startDate,
          imageUrl: anime.imageUrl,
          userAnime: anime.userAnime || null
        },
        status: null,
        airingInfo: {
          ...anime,
          userAnime: anime.userAnime || null,
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

<div class="homepage">
  <!-- Hero Banner Section -->
  {#if sortedCurrentlyAiring.length > 0}
    <div class="hero-wrapper">
      {#if bannerAnime}
        {#key bannerAnime.id}
          <HeroBanner
            anime={bannerAnime}
          />
        {/key}
      {:else}
        <HeroBannerSkeleton />
      {/if}
    </div>
  {:else if ($homeDataQuery.data || homeData)?.topRatedAnime?.length > 0}
    <div class="hero-wrapper">
      {#if ($homeDataQuery.data || homeData).topRatedAnime[0]}
        {@const fallbackAnime = ($homeDataQuery.data || homeData).topRatedAnime[0]}
        <HeroBanner
          anime={fallbackAnime}
        />
      {/if}
    </div>
  {/if}

  <!-- Airing This Week -->
  {#if sortedCurrentlyAiring.length > 0}
    <section class="section">
      <SectionHeader title="Airing This Week" href="/airing" linkText="View schedule →" />
      <div class="airing-strip">
        {#each sortedCurrentlyAiring.slice(0, 8) as entry, index}
          <AiringStripCard
            id={entry.anime.id}
            title={getAnimeTitle(entry.anime, $preferencesStore.titleLanguage)}
            image={GetImageFromAnime(entry.anime)}
            episodeText={entry.airingInfo?.nextEpisode?.episodeNumber ? `Episode ${entry.airingInfo.nextEpisode.episodeNumber}` : ''}
            localTime={entry.airingInfo?.nextEpisodeDate ? format(entry.airingInfo.nextEpisodeDate, "EEE h:mm a") : ''}
            timeText={entry.airingInfo?.airTimeDisplay?.text || ''}
            isLive={entry.airingInfo?.airTimeDisplay?.variant === 'airing'}
            currentEpisode={entry.airingInfo?.nextEpisode?.episodeNumber || 0}
            totalEpisodes={entry.anime.episodeCount || 0}
            on:mouseenter={() => hoveredAnime = entry.airingInfo}
            on:mouseleave={() => hoveredAnime = null}
          />
        {/each}
      </div>
    </section>
  {/if}

  <!-- Top Rated -->
  {#if ($homeDataQuery.data || homeData)?.topRatedAnime}
    {@const _dbgTopRated = ($homeDataQuery.data || homeData).topRatedAnime}
    {console.log("[TOPRATED", ($homeDataQuery.data || homeData).topRatedAnime.slice(0, 14))}
    {(() => { if (typeof window !== 'undefined' && _dbgTopRated?.length) console.log('[WATCHLIST]', 'topRated[0].userAnime:', _dbgTopRated[0]?.userAnime, 'status:', _dbgTopRated[0]?.userAnime?.status, 'all userAnimes:', _dbgTopRated.map(a => ({ title: a.titleEn?.slice(0,20), ua: a.userAnime?.status || 'NONE' }))); return ''; })()}
    <section class="section">
      <SectionHeader title="Top Rated" href="/search" linkText="See all →" />
      <div class="poster-row">
        {#each ($homeDataQuery.data || homeData).topRatedAnime.slice(0, 14) as anime}
          <PosterCard
            id={anime.id}
            title={getAnimeTitle(anime, $preferencesStore.titleLanguage)}
            image={GetImageFromAnime(anime)}
            score={anime.rating}
            status={anime.status}
            genres={anime.tags || []}
            description={anime.description || ''}
            episodeCount={anime.episodeCount}
            sub="{Math.max(anime.episodeCount || 0, anime.episodes?.length || 0)} ep · {anime.studios?.[0] || getYearUTC(anime.startDate)}"
            onList={anime.userAnime?.status || null}
          />
        {/each}
      </div>
    </section>
  {/if}

  <!-- Newest Anime -->
  {#if ($homeDataQuery.data || homeData)?.newestAnime}
    <section class="section">
      <SectionHeader title="Newest Anime" href="/search" linkText="See all →" />
      <div class="poster-row">
        {#each ($homeDataQuery.data || homeData).newestAnime.slice(0, 14) as anime}
          <PosterCard
            id={anime.id}
            title={getAnimeTitle(anime, $preferencesStore.titleLanguage)}
            image={GetImageFromAnime(anime)}
            score={anime.rating}
            status={anime.status}
            genres={anime.tags || []}
            description={anime.description || ''}
            episodeCount={anime.episodeCount}
            sub="{Math.max(anime.episodeCount || 0, anime.episodes?.length || 0)} ep · {anime.studios?.[0] || getYearUTC(anime.startDate)}"
            onList={anime.userAnime?.status || null}
          />
        {/each}
      </div>
    </section>
  {/if}

  <!-- Browse by Genre -->
  <section class="section">
    <SectionHeader title="Browse by Genre" />
    <GenrePills />
  </section>

  <!-- Seasonal Highlights -->
  <section class="section">
    <div class="section-header-with-tabs">
      <SectionHeader title="{getSeasonDisplayName(selectedSeason)} Highlights" href="/season/{selectedSeason}" linkText="Full season →" />
      <div class="season-tabs">
        {#each seasonOptions as season}
          <button
            on:click={() => selectedSeason = season}
            class="season-tab {selectedSeason === season ? 'active' : ''}"
          >
            {getSeasonDisplayName(season)}
          </button>
        {/each}
      </div>
    </div>
    <div class="poster-row">
      {#if $seasonalAnimeQuery.isLoading && selectedSeason !== currentSeason}
        {#each Array(6) as _}
          <div class="poster-card-skeleton">
            <div class="poster-skeleton"></div>
            <div class="title-skeleton"></div>
            <div class="sub-skeleton"></div>
          </div>
        {/each}
      {:else if currentSeasonalData?.animeBySeasons}
        {#each currentSeasonalData.animeBySeasons.sort((a, b) => {
          const getRating = (rating) => {
            if (!rating || rating === 'N/A') return 0;
            const parsed = parseFloat(rating);
            return isNaN(parsed) ? 0 : parsed;
          };
          return getRating(b.rating) - getRating(a.rating);
        }).slice(0, 14) as anime (anime.id)}
          <PosterCard
            id={anime.id}
            title={getAnimeTitle(anime, $preferencesStore.titleLanguage)}
            image={GetImageFromAnime(anime)}
            score={anime.rating}
            status={anime.status}
            genres={anime.tags || []}
            description={anime.description || ''}
            episodeCount={anime.episodeCount}
            sub="{Math.max(anime.episodeCount || 0, anime.episodes?.length || 0)} ep · {anime.studios?.[0] || getYearUTC(anime.startDate)}"
            onList={anime.userAnime?.status || null}
          />
        {/each}
      {/if}
    </div>
  </section>
</div>

<style>
  .homepage {
    width: 100%;
    overflow-x: clip;
  }
  .hero-wrapper {
    width: 100%;
    position: relative;
  }

  /* --- SECTIONS --- */
  .section {
    padding: 48px var(--weeb-section-px, 48px);
  }
  .section + .section {
    border-top: 1px solid var(--weeb-border, oklch(28% 0.015 275));
  }

  /* --- POSTER GRID --- */
  .poster-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 16px;
  }
  .poster-row :global(> *) {
    max-width: 200px;
  }

  /* --- AIRING STRIP --- */
  .airing-strip {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding-bottom: 8px;
    scrollbar-width: thin;
    scrollbar-color: var(--weeb-border) transparent;
  }

  /* --- SEASON TABS --- */
  .section-header-with-tabs {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }
  .section-header-with-tabs :global(.section-header) {
    margin-bottom: 0;
  }
  .season-tabs {
    display: flex;
    gap: 6px;
  }
  .season-tab {
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    font-family: inherit;
  }
  .season-tab:hover {
    color: var(--weeb-fg);
    background: var(--weeb-surface);
  }
  .season-tab.active {
    color: white;
    background: var(--weeb-accent);
  }

  /* --- SKELETON --- */
  .poster-card-skeleton {
    display: flex;
    flex-direction: column;
  }
  .poster-skeleton {
    aspect-ratio: 2/3;
    border-radius: var(--weeb-radius, 8px);
    background: var(--weeb-surface);
    animation: shimmer 1.5s infinite;
  }
  .title-skeleton {
    margin-top: 8px;
    height: 14px;
    width: 80%;
    border-radius: 4px;
    background: var(--weeb-surface);
    animation: shimmer 1.5s infinite;
  }
  .sub-skeleton {
    margin-top: 4px;
    height: 12px;
    width: 60%;
    border-radius: 4px;
    background: var(--weeb-surface);
    animation: shimmer 1.5s infinite;
  }
  @keyframes shimmer {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.8; }
  }

  /* --- RESPONSIVE --- */
  @media (max-width: 768px) {
    .section {
      padding: 28px 16px;
    }
    .poster-row {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 12px;
    }
    .season-tabs {
      flex-wrap: wrap;
    }
  }
  @media (max-width: 400px) {
    .section {
      padding: 24px 12px;
    }
    .poster-row {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 10px;
    }
  }
</style>
