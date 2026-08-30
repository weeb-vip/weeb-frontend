<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { format } from 'date-fns';
  import { onMount } from 'svelte';
  import HeroBanner from './HeroBanner.svelte';
  import HeroBannerSkeleton from './HeroBannerSkeleton.svelte';
  import HeroAiringRail from './HeroAiringRail.svelte';
  import { isPhone, isTablet } from '../stores/viewport';
  import PosterCard from './PosterCard.svelte';
  import SectionHeader from './SectionHeader.svelte';
  import GenrePills from './GenrePills.svelte';
  import PosterGrid from './PosterGrid.svelte';
  import { initializeQueryClient } from '../services/query-client';
  import {
    fetchHomePageData,
    fetchCurrentlyAiring,
    fetchSeasonalAnime, fetchCurrentlyAiringWithDates
  } from '../../services/queries';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';
  import { findNextEpisode, parseDurationToMinutes, resolveEpisodeTiming } from '../../services/airTimeUtils';
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
  type DebugWindow = Window & { refreshHomepageData?: () => void };

  export let homeData: any;
  export let currentlyAiringData: any;
  export let seasonalData: any;
  export let currentSeason: string;
  export let isTokenExpired: boolean = false;

  let selectedSeason = currentSeason;
  let isDropdownOpen = false;

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
  // "0 ep · 2026" was shipping on any show whose episode count had not landed
  // yet, which is a fact the card does not know stated as one it does. Drop the
  // part that has no value rather than printing a zero.
  // The shows the visitor is actually following, out of what is airing.
  //
  // No new query: currentlyAiring already returns userAnime, and the SSR fetch
  // carries the auth cookie, so this is resolved on the server like everything
  // else on the page. It also means no separate signed-in check -- a signed-out
  // visitor has userAnime null on every entry, so the list is empty and the
  // section does not render.
  //
  // WATCHING only. Plan to Watch is a list of intentions, not a thing you are
  // waiting on an episode of, and mixing the two turns "what is next for me"
  // into a second seasonal shelf.
  $: myAiring = sortedCurrentlyAiring.filter(
    (entry: any) => entry?.anime?.userAnime?.status === 'WATCHING'
  );

  // Episode and countdown, because that is what this section is for. The other
  // shelves show episode count and studio, which say nothing about when.
  function watchingSub(entry: any): string {
    const timing = entry?.airingInfo?.timing;
    const episode = entry?.airingInfo?.nextEpisode?.episodeNumber;
    const parts: string[] = [];
    if (episode) parts.push(`EP ${episode}`);
    if (timing?.isLive) parts.push('Airing now');
    else if (timing?.countdown) parts.push(`in ${timing.countdown}`);
    else if (timing?.localTime) parts.push(String(timing.localTime));

    return parts.join(' \u00b7 ');
  }

  function posterSub(anime: any): string {
    const episodes = Math.max(anime.episodeCount || 0, anime.episodes?.length || 0);
    const origin = anime.studios?.[0] || getYearUTC(anime.startDate);
    const parts: string[] = [];
    if (episodes > 0) parts.push(`${episodes} ep`);
    if (origin) parts.push(String(origin));
    return parts.join(' \u00b7 ');
  }

  // A grid fills its row whatever the count, so the only thing a breakpoint
  // changes is how many ROWS a shelf costs. Twenty items is two rows on a wide
  // monitor and ten on a phone, which is why the count is not fixed: six keeps a
  // phone section to three rows, and "See all" owns completeness either way.
  $: shelfLimit = $isPhone ? 6 : $isTablet ? 12 : 20;

  let hoveredAnime: any = null;

  // One clock for the whole schedule. The hero and the rail both derive their
  // countdown from this tick, so they advance together instead of drifting into
  // the "18H" / "Airing in 19h" disagreement they used to show side by side.
  let now = new Date();
  onMount(() => {
    const id = setInterval(() => (now = new Date()), 30_000);
    return () => clearInterval(id);
  });
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
    (window as DebugWindow).refreshHomepageData = refreshAllData;

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
      delete (window as DebugWindow).refreshHomepageData;
    };
  });

  // Process currently airing data
  function processCurrentlyAiring(data: any, current: Date) {
    if (!data?.currentlyAiring) return [];

    const now = current;
    const currentlyAiringShows = data.currentlyAiring || [];
    const processedAnime: any[] = [];

    currentlyAiringShows.forEach((anime: any) => {
      if (!anime || !anime.nextEpisode) return;

      const nextEpisode = anime.nextEpisode;

      // Skip anime where nextEpisode has null airdate or airTime
      if (!nextEpisode.airDate && !nextEpisode.airTime) return;

      // Resolved once, here, and handed to every consumer. This used to be two
      // derivations: nextEpisodeDate came from the exact airTime while
      // airTimeDisplay came from (airDate, broadcast), so the rail and the hero
      // printed different days for the same episode.
      const timing = resolveEpisodeTiming(
        nextEpisode,
        anime.broadcast,
        parseDurationToMinutes(anime.duration),
        now
      );
      if (!timing) return;

      const processedEntry = {
        id: `homepage-${anime.id}`,
        anime: {
          id: anime.id,
          // Needed for the card's href. This object is rebuilt field by field,
          // so anything omitted is lost even though the query returned it --
          // which is how these cards linked to /anime/<uuid> while other
          // sections on the same page linked to /anime/<slug>.
          slug: anime.slug,
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
          timing,
          // Kept as a view onto `timing` so existing consumers of the old shape
          // read the same resolved value rather than a second opinion.
          airTimeDisplay: { show: true, text: timing.label, variant: timing.variant },
          nextEpisodeDate: timing.airDateTime,
          nextEpisode: {
            ...nextEpisode,
            airDate: timing.airDateTime
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

  // Process currently airing data from queries (with SSR fallback)
  $: sortedCurrentlyAiring = processCurrentlyAiring($currentlyAiringQuery.data || currentlyAiringData, now);

  // Get current seasonal data - use query data when available, SSR data as fallback
  $: currentSeasonalData = selectedSeason === currentSeason
    ? ($seasonalAnimeQuery.data || seasonalData)
    : $seasonalAnimeQuery.data;

  // Set up anime notifications when currently airing data is available
  $: if (currentlyAiringData?.currentlyAiring) {
    const animeForNotifications = currentlyAiringData.currentlyAiring.map(anime => ({
      id: anime.id,
      // The toast links to the anime, so it needs the slug like any other link.
      slug: anime.slug,
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
  <!-- The page's actual heading. Visually hidden because the design leads with the hero
       carousel rather than a title, but the document still needs one h1 describing the
       page: the only h1 used to be the carousel's current anime, so the homepage's
       primary heading changed with whichever show happened to be featured. -->
  <h1 class="sr-only">WeebVIP — track your anime watchlist</h1>

  <!-- Hero Banner Section -->
  {#if sortedCurrentlyAiring.length > 0}
    <div class="hero-wrapper">
      {#if bannerAnime}
        {#key bannerAnime.id}
          <HeroBanner
            anime={bannerAnime}
            timing={bannerAnime.timing ?? null}
          />
        {/key}
      {:else}
        <HeroBannerSkeleton />
      {/if}
      <!-- Sibling of the keyed banner, not a child: the banner remounts on every
           selection and the rail must not, or it would lose focus mid-keyboard
           navigation. -->
      <HeroAiringRail
        entries={sortedCurrentlyAiring}
        activeId={bannerAnime?.id ?? null}
        onSelect={(info) => (hoveredAnime = info)}
      />
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


  <!-- Airing from your list -->
  <!-- First thing under the hero, because the product's recurring loop starts
       with "what aired for the shows I follow" and nothing on this page used to
       answer it. Renders only when there is something in it, so a signed-out
       homepage is unchanged rather than carrying an empty shelf. -->
  {#if myAiring.length > 0}
    <section class="section">
      <SectionHeader title="Airing from your list" href="/profile/anime" linkText="Your list →" />
      <PosterGrid>
        {#each myAiring as entry (entry.anime.id)}
          <!-- status comes off airingInfo: the anime object is rebuilt field by
               field above and drops animeStatus, while airingInfo spreads the
               whole record. -->
          <PosterCard
            id={entry.anime.id}
            slug={entry.anime.slug}
            title={getAnimeTitle(entry.anime, $preferencesStore.titleLanguage)}
            image={GetImageFromAnime(entry.anime)}
            status={entry.airingInfo?.animeStatus || null}
            sub={watchingSub(entry)}
            genres={entry.anime.tags || []}
            description={entry.anime.description || ''}
            episodeCount={entry.anime.episodeCount}
            onList={entry.anime.userAnime?.status || null}
          />
        {/each}
      </PosterGrid>
    </section>
  {/if}

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
    <PosterGrid>
      {#if $seasonalAnimeQuery.isLoading && selectedSeason !== currentSeason}
        {#each Array(12) as _}
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
        }).slice(0, shelfLimit) as anime (anime.id)}
          <PosterCard
            id={anime.id}
            slug={anime.slug}
            title={getAnimeTitle(anime, $preferencesStore.titleLanguage)}
            image={GetImageFromAnime(anime)}
            score={anime.rating}
            status={anime.status}
            genres={anime.tags || []}
            description={anime.description || ''}
            episodeCount={anime.episodeCount}
            sub={posterSub(anime)}
            onList={anime.userAnime?.status || null}
          />
        {/each}
      {/if}
    </PosterGrid>
  </section>
  <!-- Top Rated -->
  {#if ($homeDataQuery.data || homeData)?.topRatedAnime}
    <section class="section">
      <SectionHeader title="Top Rated" href="/search" linkText="See all →" />
      <PosterGrid>
        {#each ($homeDataQuery.data || homeData).topRatedAnime.slice(0, shelfLimit) as anime}
          <PosterCard
            id={anime.id}
            slug={anime.slug}
            title={getAnimeTitle(anime, $preferencesStore.titleLanguage)}
            image={GetImageFromAnime(anime)}
            score={anime.rating}
            status={anime.status}
            genres={anime.tags || []}
            description={anime.description || ''}
            episodeCount={anime.episodeCount}
            sub={posterSub(anime)}
            onList={anime.userAnime?.status || null}
          />
        {/each}
      </PosterGrid>
    </section>
  {/if}

  <!-- Browse by Tag -->
  <section class="section">
    <SectionHeader title="Browse by Tag" />
    <GenrePills />
  </section>

</div>

<style>
  .homepage {
    width: 100%;
    overflow-x: clip;
  }
  /* The banner runs up under the transparent nav, so it starts at the top of the
     document rather than below the bar. */
  .hero-wrapper {
    /* Extra banner below the fold carrying the dissolve into the page ground.
       The first screen stays pure artwork; the fade is only ever revealed by
       scrolling. Everything bottom-anchored inside the banner offsets by this
       same value so the composition does not move down with it. */
    --hero-fade: 100px;
    width: 100%;
    position: relative;
    margin-top: calc(-1 * var(--weeb-nav-height, 60px));
  }
  @media (max-width: 767px) {
    .hero-wrapper { --hero-fade: 70px; }
  }

  /* --- SECTIONS --- */
  .section {
    padding: 48px var(--weeb-section-px, 48px);
  }
  .section + .section {
    border-top: 1px solid var(--weeb-border, oklch(28% 0.015 275));
  }

  /* --- POSTER GRID ---
     A grid, not a horizontal shelf. A carousel inside a vertically scrolling
     page asks the reader to change gesture axis to reach content, and on a phone
     it competes with the page scroll itself; everything past the second card
     goes unseen. The grid also fills its row for free -- auto-fill with 1fr
     tracks stretches to the full width whatever the item count, which a
     fixed-width shelf cannot do without either stranding a gap or inflating the
     cards.

     The length problem a grid used to have was never the grid. It was fourteen
     items in it: at two columns that is seven rows per section. The count is
     capped per breakpoint instead (see shelfLimit). */
  /* The poster grid lives in PosterGrid.svelte. */

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
    min-height: 44px;
    padding: 6px 14px;
    border-radius: var(--weeb-radius, 8px);
    font-size: 12px;
    font-weight: 600;
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
  @media (max-width: 767px) {
    .section {
      padding: var(--weeb-section-py, 32px) var(--weeb-section-px, 24px);
    }
    .season-tabs {
      flex-wrap: wrap;
    }
  }
  @media (max-width: 400px) {
    .section {
      padding: var(--weeb-section-py, 24px) var(--weeb-section-px, 16px);
    }
  }
</style>
