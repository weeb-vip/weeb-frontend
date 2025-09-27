<script lang="ts">
  import { onMount } from 'svelte';
  import { createQuery, createMutation } from '@tanstack/svelte-query';
  import { format } from 'date-fns';
  import { initializeQueryClient } from '../services/query-client';
  import { getUser, fetchUserAnimes, fetchCurrentlyAiringWithDatesAndEpisodes } from '../../services/queries';
  import { GetImageFromAnime } from '../../services/utils';
  import { getAirTimeDisplay, findNextEpisode, getCurrentTime, parseAirTime } from '../../services/airTimeUtils';
  import Button from './Button.svelte';
  import AnimeCard from './AnimeCard.svelte';
  import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
  import ProfileImageUpload from './ProfileImageUpload.svelte';
  import '@fortawesome/fontawesome-free/css/all.min.css';
  import { configStore } from '../stores/config';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';
  import { navigateWithTransition } from '../../utils/astro-navigation';
  import { Status } from '../../gql/graphql';

  // Initialize query client
  const queryClient = initializeQueryClient();

  // State
  let showUploadModal = false;
  let mounted = false;

  // Client-side only queries
  let userQuery: any;
  let watchingQuery: any;
  let planToWatchQuery: any;
  let completedQuery: any;
  let droppedQuery: any;
  let onHoldQuery: any;
  let currentlyAiringQuery: any;

  function getProfileImageUrl(profileImageUrl: string | null): string | undefined {
    if (!profileImageUrl) return undefined;
    const config = configStore.get();
    const cdnUserUrl = config?.cdn_user_url || 'https://cdn.weeb.vip/weeb-user-staging';
    const suffix = '_64';
    // Insert suffix before file extension
    const lastDotIndex = profileImageUrl.lastIndexOf('.');
    if (lastDotIndex === -1) return `${cdnUserUrl}/${profileImageUrl}${suffix}`;

    const nameWithoutExt = profileImageUrl.substring(0, lastDotIndex);
    const extension = profileImageUrl.substring(lastDotIndex);
    return `${cdnUserUrl}/${nameWithoutExt}${suffix}${extension}`;
  }

  onMount(async () => {
    mounted = true;

    // Initialize config store
    await configStore.init();

    // Initialize queries only on client side
    userQuery = createQuery(getUser(), queryClient);

    watchingQuery = createQuery(
      fetchUserAnimes({ input: { status: Status.Watching, limit: 1000, page: 1 } }),
      queryClient
    );

    planToWatchQuery = createQuery(
      fetchUserAnimes({ input: { status: Status.Plantowatch, limit: 1000, page: 1 } }),
      queryClient
    );

    completedQuery = createQuery(
      fetchUserAnimes({ input: { status: Status.Completed, limit: 1000, page: 1 } }),
      queryClient
    );

    droppedQuery = createQuery(
      fetchUserAnimes({ input: { status: Status.Dropped, limit: 1000, page: 1 } }),
      queryClient
    );

    onHoldQuery = createQuery(
      fetchUserAnimes({ input: { status: Status.Onhold, limit: 1000, page: 1 } }),
      queryClient
    );

    // Fetch currently airing shows for a 2-week window (WITH EPISODES!)
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    currentlyAiringQuery = createQuery(
      fetchCurrentlyAiringWithDatesAndEpisodes(startDate, endDate),
      queryClient
    );
  });

  // Process watchlist and airing data
  $: watchlistAnalysis = (() => {
    if (!mounted || !userQuery || !watchingQuery || !planToWatchQuery || !completedQuery || !droppedQuery || !onHoldQuery || !currentlyAiringQuery) {
      return {
        watching: 0,
        planToWatch: 0,
        completed: 0,
        dropped: 0,
        onHold: 0,
        airingSoon: [],
        recentlyAired: [],
        isLoading: true
      };
    }

    // Check if data is still loading
    const isLoading = $watchingQuery.isLoading || $planToWatchQuery.isLoading || $currentlyAiringQuery.isLoading;

    const watching = $watchingQuery.data?.animes || [];
    const planToWatch = $planToWatchQuery.data?.animes || [];
    const currentlyAiringShows = $currentlyAiringQuery.data?.currentlyAiring || [];

    // Create lookup map of currently airing shows by ID
    const airingMap = new Map();
    currentlyAiringShows.forEach(anime => {
      if (anime) {
        airingMap.set(anime.id, anime);
      }
    });

    const allWatchlistShows = [...watching, ...planToWatch];
    const airingSoon: any[] = [];
    const recentlyAired: any[] = [];
    const now = getCurrentTime();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Create set of watchlist anime IDs for quick lookup
    const watchlistIds = new Set(allWatchlistShows.map(entry => entry.anime?.id).filter(Boolean));

    // Process all currently airing shows
    currentlyAiringShows.forEach(airingInfo => {
      if (!airingInfo) return;
      if (!airingInfo.episodes || airingInfo.episodes.length === 0) return;
      // Only process shows that are in the user's watchlist
      if (!watchlistIds.has(airingInfo.id)) return;

      const episodes = airingInfo.episodes;

      // Find the next episode
      const nextEpisodeResult = findNextEpisode(episodes, airingInfo.broadcast, now);

      if (nextEpisodeResult) {
        const { episode: nextEpisode, airTime: nextEpisodeAirTime } = nextEpisodeResult;

        // Only include if episode is within the next 7 days or recently aired
        const episodeDurationMs = airingInfo.duration ? parseInt(airingInfo.duration) * 60 * 1000 : 30 * 60 * 1000;
        const nowMinusEpisodeDuration = new Date(now.getTime() - episodeDurationMs);

        if (nextEpisodeAirTime <= sevenDaysFromNow && nextEpisodeAirTime >= nowMinusEpisodeDuration) {
          // Generate air time display info
          const airTimeInfo = getAirTimeDisplay(nextEpisode.airDate, airingInfo.broadcast) || {
            show: true,
            text: nextEpisodeAirTime <= now
              ? "Recently aired"
              : `${format(nextEpisodeAirTime, "EEE")} at ${format(nextEpisodeAirTime, "h:mm a")}`,
            variant: nextEpisodeAirTime <= now ? 'aired' : 'scheduled'
          };

          // Get the watchlist entry for this anime (we know it exists since we filtered above)
          const watchlistEntry = allWatchlistShows.find(entry => entry.anime?.id === airingInfo.id);

          const enhancedEntry = {
            ...watchlistEntry,
            airingInfo: {
              ...airingInfo,
              airTimeDisplay: airTimeInfo,
              nextEpisodeDate: nextEpisodeAirTime,
              nextEpisode: {
                ...nextEpisode,
                airDate: nextEpisodeAirTime
              },
              isInWatchlist: true
            }
          };

          if (nextEpisodeAirTime <= now) {
            recentlyAired.push(enhancedEntry);
          } else {
            airingSoon.push(enhancedEntry);
          }
        }
      }
    });

    // Cross-reference watchlist with currently airing shows for recently aired (watchlist only)
    allWatchlistShows.forEach(entry => {
      const anime = entry.anime;
      if (!anime) return;

      const airingInfo = airingMap.get(anime.id);

      if (airingInfo) {
        // Check for recently aired episodes
        if (airingInfo.episodes && airingInfo.episodes.length > 0) {
          // Find the most recent episode that aired in the last 2 weeks
          const recentEpisodes = airingInfo.episodes
            .filter((ep: any) => ep.airDate)
            .map((ep: any) => {
              // Use parseAirTime to get the correct air time with timezone conversion
              const parsedAirTime = parseAirTime(ep.airDate, airingInfo.broadcast);
              return parsedAirTime ? { ...ep, airDate: parsedAirTime } : null;
            })
            .filter((ep: any) => ep !== null)
            .filter((ep: any) => {
              // Only include episodes that have actually aired (in the past) and within the last 2 weeks
              const epTime = ep.airDate.getTime();
              const nowTime = now.getTime();
              return epTime < nowTime && epTime >= twoWeeksAgo.getTime();
            })
            .sort((a: any, b: any) => b.airDate.getTime() - a.airDate.getTime()); // Most recent first

          if (recentEpisodes.length > 0) {
            const mostRecentEpisode = recentEpisodes[0];

            // Use proper date comparison to avoid timezone issues
            const airDate = mostRecentEpisode.airDate;
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            const episodeDate = new Date(airDate.getFullYear(), airDate.getMonth(), airDate.getDate());

            let daysSinceAiredText;
            if (episodeDate.getTime() === today.getTime()) {
              daysSinceAiredText = 'Today';
            } else if (episodeDate.getTime() === yesterday.getTime()) {
              daysSinceAiredText = 'Yesterday';
            } else {
              const daysDiff = Math.floor((today.getTime() - episodeDate.getTime()) / (1000 * 60 * 60 * 24));
              daysSinceAiredText = `${daysDiff} days ago`;
            }

            const airTimeText = format(mostRecentEpisode.airDate, 'h:mm a');
            const airDayText = format(mostRecentEpisode.airDate, 'EEE');

            const recentAirTimeInfo = {
              show: true,
              text: `Aired ${daysSinceAiredText} (${airDayText} at ${airTimeText})`,
              variant: 'aired'
            };

            const enhancedEntry = {
              ...entry,
              airingInfo: {
                ...airingInfo,
                airTimeDisplay: recentAirTimeInfo,
                recentEpisode: mostRecentEpisode,
                nextEpisode: mostRecentEpisode,
                nextEpisodeDate: mostRecentEpisode.airDate,
                daysSinceAired: Math.floor((today.getTime() - episodeDate.getTime()) / (1000 * 60 * 60 * 24))
              }
            };

            recentlyAired.push(enhancedEntry);
          }
        }
      }
    });

    // Sort by air date proximity (soonest first)
    airingSoon.sort((a, b) => {
      const aDate = a.airingInfo?.nextEpisodeDate || new Date();
      const bDate = b.airingInfo?.nextEpisodeDate || new Date();
      return aDate.getTime() - bDate.getTime();
    });

    recentlyAired.sort((a, b) => {
      // Sort by actual air time (most recent first) using parseAirTime for proper timezone conversion
      const aEpisode = a.airingInfo?.recentEpisode;
      const bEpisode = b.airingInfo?.recentEpisode;
      const aBroadcast = a.airingInfo?.broadcast;
      const bBroadcast = b.airingInfo?.broadcast;

      const aAirTime = (aEpisode?.airDate && aBroadcast) ? parseAirTime(aEpisode.airDate, aBroadcast)?.getTime() || 0 : 0;
      const bAirTime = (bEpisode?.airDate && bBroadcast) ? parseAirTime(bEpisode.airDate, bBroadcast)?.getTime() || 0 : 0;
      return bAirTime - aAirTime; // Most recent first (descending order)
    });

    // Process currently watching shows to add episode timing info
    const currentlyWatching = watching.slice(0, 6).map(entry => {
      const anime = entry.anime;
      if (!anime) return entry;

      let airTimeDisplay: any = undefined;
      let nextEpisode: any = null;

      if (anime.episodes && anime.episodes.length > 0) {
        // Calculate timing info using episodes from the watchlist query
        const episodes = anime.episodes;

        // Find next episode
        const nextEpisodeResult = findNextEpisode(episodes, anime.broadcast, now);

        if (nextEpisodeResult) {
          const { episode, airTime } = nextEpisodeResult;
          nextEpisode = episode;

          const daysDiff = Math.ceil((airTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (airTime <= now) {
            airTimeDisplay = {
              show: true,
              text: "Recently aired",
              variant: 'aired'
            };
          } else if (daysDiff <= 7) {
            airTimeDisplay = {
              show: true,
              text: `Next episode ${format(airTime, "EEE")} at ${format(airTime, "h:mm a")}`,
              variant: 'scheduled'
            };
          } else {
            airTimeDisplay = {
              show: true,
              text: `Next episode in ${daysDiff} days`,
              variant: 'scheduled'
            };
          }
        } else {
          // No future episodes, find the last episode
          const pastEpisodes = episodes
            .filter((ep: any) => ep.airDate)
            .map((ep: any) => {
              const parsedAirTime = parseAirTime(ep.airDate, anime.broadcast);
              return parsedAirTime ? { ...ep, airDate: parsedAirTime } : null;
            })
            .filter((ep: any) => ep !== null && ep.airDate.getTime() < now.getTime())
            .sort((a: any, b: any) => b.airDate.getTime() - a.airDate.getTime());

          if (pastEpisodes.length > 0) {
            const lastEpisode = pastEpisodes[0];
            const daysSinceFinished = Math.floor((now.getTime() - lastEpisode.airDate.getTime()) / (1000 * 60 * 60 * 24));

            // Format the finish date
            const finishDateText = daysSinceFinished < 1
              ? "Finished today"
              : daysSinceFinished < 2
                ? "Finished yesterday"
                : `Finished ${format(lastEpisode.airDate, "MMM d, yyyy")}`;

            airTimeDisplay = {
              show: true,
              text: finishDateText,
              variant: 'aired'
            };
          }
        }
      }

      return {
        ...entry,
        airTimeDisplay,
        nextEpisode
      };
    });

    return {
      watching: watching.length,
      planToWatch: planToWatch.length,
      completed: $completedQuery.data?.total || 0,
      dropped: $droppedQuery.data?.total || 0,
      onHold: $onHoldQuery.data?.total || 0,
      airingSoon: airingSoon.slice(0, 12),
      recentlyAired: recentlyAired.slice(0, 6),
      currentlyWatching,
      isLoading
    };
  })();

  function navigateToAnime(animeId: string) {
    navigateWithTransition(`/show/${animeId}`);
  }
</script>

<div class="max-w-screen-2xl mx-auto px-4 py-8">
  {#if !mounted || !userQuery || (userQuery && $userQuery.isLoading)}
    <!-- Loading skeleton -->
    <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8 animate-pulse">
      <div class="flex items-center space-x-4 mb-4">
        <div class="w-20 h-20 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        <div class="h-6 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {#each Array(4) as _}
          <div>
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
            <div class="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
          </div>
        {/each}
      </div>
    </div>
  {:else if userQuery && $userQuery.data}
    <!-- User Info Section -->
    <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8 transition-colors duration-300">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center space-x-4">
          <div class="relative group">
            <div class="w-20 h-20 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
              {#if $userQuery.data.profileImageUrl}
                <img
                  src={getProfileImageUrl($userQuery.data.profileImageUrl)}
                  alt={$userQuery.data.username}
                  class="w-full h-full object-cover"
                />
              {:else}
                <div class="w-full h-full flex items-center justify-center text-2xl font-semibold text-gray-600 dark:text-gray-400">
                  {$userQuery.data.username.charAt(0).toUpperCase()}
                </div>
              {/if}
            </div>
            <button
              on:click={() => showUploadModal = true}
              class="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
              aria-label="Change profile picture"
            >
              <span class="text-white text-sm font-medium">Change</span>
            </button>
          </div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Profile</h2>
        </div>
        <a
          href="/profile/settings"
          class="text-blue-600 dark:text-blue-400 hover:underline transition-colors duration-300 text-sm"
        >
          Settings
        </a>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <p class="text-gray-600 dark:text-gray-400">Name</p>
          <p class="text-gray-900 dark:text-gray-100 font-medium">
            {$userQuery.data.firstname} {$userQuery.data.lastname}
          </p>
        </div>
        <div>
          <p class="text-gray-600 dark:text-gray-400">Username</p>
          <p class="text-gray-900 dark:text-gray-100 font-medium">{$userQuery.data.username}</p>
        </div>
        <div>
          <p class="text-gray-600 dark:text-gray-400">Email</p>
          <p class="text-gray-900 dark:text-gray-100 font-medium">
            {$userQuery.data.email || "Not provided"}
          </p>
        </div>
        <div>
          <p class="text-gray-600 dark:text-gray-400">Language</p>
          <p class="text-gray-900 dark:text-gray-100 font-medium">{$userQuery.data.language}</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Dashboard Section -->
  <div class="space-y-8">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
      <a
        href="/profile/anime"
        class="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
      >
        <i class="fas fa-bookmark"></i> View All Lists →
      </a>
    </div>
    <!-- Currently Watching Section -->
    <section>
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <i class="fas fa-play text-blue-500 text-xl"></i>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Currently Watching
          </h2>
          {#if !watchlistAnalysis.isLoading && watchlistAnalysis.currentlyWatching && watchlistAnalysis.currentlyWatching.length > 0}
            <span class="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-medium px-2 py-1 rounded-full">
              {watchlistAnalysis.currentlyWatching.length}
            </span>
          {/if}
        </div>
        {#if !watchlistAnalysis.isLoading && watchlistAnalysis.watching > 0}
          <a
            href="/profile/anime"
            class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-sm flex items-center gap-1"
          >
            View All →
          </a>
        {/if}
      </div>

      {#if watchlistAnalysis.isLoading}
        <!-- Loading skeleton for Currently Watching -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {#each Array(6) as _}
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 animate-pulse">
              <div class="flex gap-3">
                <div class="w-16 h-24 bg-gray-300 dark:bg-gray-600 rounded"></div>
                <div class="flex-1">
                  <div class="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                  <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else if watchlistAnalysis.currentlyWatching && watchlistAnalysis.currentlyWatching.length > 0}
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {#each watchlistAnalysis.currentlyWatching as entry}
            <AnimeCard
              forceListLayout={true}
              id={entry.anime?.id}
              style="detail"
              title={getAnimeTitle(entry.anime, $preferencesStore.titleLanguage)}
              description={entry.anime?.description || ""}
              episodes={entry.anime?.episodeCount || 0}
              episodeLength={entry.anime?.duration?.replace(/per.+?$|per/gm, '') || "?"}
              image={GetImageFromAnime(entry.anime)}
              onClick={() => navigateToAnime(entry.anime?.id)}
              year=""
              airTime={entry.airTimeDisplay}
              showWatchingFallback={true}
              nextEpisode={entry.nextEpisode}
              broadcast={entry.anime?.broadcast}
            >
              <div slot="options">
                <AnimeStatusDropdown
                  entry={entry}
                  variant="compact"
                />
              </div>
            </AnimeCard>
          {/each}
        </div>
      {:else}
        <!-- Empty state for Currently Watching -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
          <i class="fas fa-tv text-4xl text-gray-400 dark:text-gray-600 mb-3 block"></i>
          <p class="text-gray-600 dark:text-gray-400">
            You're not currently watching any anime
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Start watching something new from your plan to watch list
          </p>
        </div>
      {/if}
    </section>

    <!-- Quick Stats -->
    <section class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm transition-colors duration-300">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Stats</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {($watchingQuery && $watchingQuery.data?.total) || 0}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Watching</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">
            {($planToWatchQuery && $planToWatchQuery.data?.total) || 0}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Plan to Watch</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-red-600 dark:text-red-400">
            {watchlistAnalysis.airingSoon.length}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">This Week</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {watchlistAnalysis.recentlyAired.length}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Recent Episodes</div>
        </div>
      </div>
    </section>

    <!-- Empty State -->
    {#if watchlistAnalysis.airingSoon.length === 0 && watchlistAnalysis.recentlyAired.length === 0 && (!watchlistAnalysis.currentlyWatching || watchlistAnalysis.currentlyWatching.length === 0)}
      <div class="text-center py-12">
        <i class="fas fa-bookmark text-6xl text-gray-300 dark:text-gray-600 mb-4 block"></i>
        <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Your watchlist is empty
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          Start adding anime to your watchlist to see personalized recommendations and airing schedules.
        </p>
        <a
          href="/"
          class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
        >
          Explore Anime →
        </a>
      </div>
    {/if}

    <!-- Airing This Week Section -->
    <section>
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <i class="fas fa-play text-red-500 text-xl"></i>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Airing This Week
          </h2>
          {#if !watchlistAnalysis.isLoading && watchlistAnalysis.airingSoon.length > 0}
            <span class="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-sm font-medium px-2 py-1 rounded-full">
              {watchlistAnalysis.airingSoon.length}
            </span>
          {/if}
        </div>
      </div>

      {#if watchlistAnalysis.isLoading}
        <!-- Loading skeleton for Airing This Week -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {#each Array(3) as _}
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 animate-pulse">
              <div class="flex gap-3">
                <div class="w-16 h-24 bg-gray-300 dark:bg-gray-600 rounded"></div>
                <div class="flex-1">
                  <div class="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                  <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else if watchlistAnalysis.airingSoon.length > 0}
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {#each watchlistAnalysis.airingSoon as entry}
            <AnimeCard
              forceListLayout={true}
              id={entry.anime?.id || entry.airingInfo?.id}
              style="episode"
              title={getAnimeTitle(entry.anime || entry.airingInfo, $preferencesStore.titleLanguage)}
              episodeTitle={entry.airingInfo.nextEpisode?.titleEn || entry.airingInfo.nextEpisode?.titleJp || "Unknown"}
              description={entry.anime?.description || ""}
              episodeLength={entry.anime?.duration?.replace(/per.+?$|per/gm, '') || "?"}
              episodeNumber={entry.airingInfo.nextEpisode?.episodeNumber?.toString() || "Unknown"}
              className="hover:cursor-pointer"
              year={entry.anime?.startDate ? new Date(entry.anime.startDate).getFullYear().toString() : "Unknown"}
              image={GetImageFromAnime(entry.anime || entry.airingInfo)}
              airdate={entry.airingInfo.nextEpisodeDate ? format(entry.airingInfo.nextEpisodeDate, "EEE MMM do") : "Unknown"}
              airTime={entry.airingInfo.airTimeDisplay}
              onClick={() => navigateToAnime(entry.anime?.id || entry.airingInfo?.id)}
              episodes={entry.anime?.episodeCount || 0}
            >
              <div slot="options">
                {#if entry.airingInfo?.isInWatchlist && entry.anime && entry.status}
                  <AnimeStatusDropdown
                    entry={entry}
                    variant="compact"
                  />
                {:else}
                  <Button
                    color="blue"
                    label="Add to list"
                    status="idle"
                    onClick={() => navigateToAnime(entry.anime?.id || entry.airingInfo?.id)}
                  />
                {/if}
              </div>
            </AnimeCard>
          {/each}
        </div>
      {:else}
        <!-- Empty state for Airing This Week -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
          <i class="fas fa-calendar-xmark text-4xl text-gray-400 dark:text-gray-600 mb-3 block"></i>
          <p class="text-gray-600 dark:text-gray-400">
            No episodes airing this week from your watchlist
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Check back later or add more anime to your watchlist
          </p>
        </div>
      {/if}
    </section>

    <!-- Recently Aired Episodes Section -->
    <section>
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <i class="fas fa-calendar-days text-green-500 text-xl"></i>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Recently Aired Episodes
          </h2>
          {#if !watchlistAnalysis.isLoading && watchlistAnalysis.recentlyAired.length > 0}
            <span class="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm font-medium px-2 py-1 rounded-full">
              {watchlistAnalysis.recentlyAired.length}
            </span>
          {/if}
        </div>
      </div>

      {#if watchlistAnalysis.isLoading}
        <!-- Loading skeleton for Recently Aired -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {#each Array(3) as _}
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 animate-pulse">
              <div class="flex gap-3">
                <div class="w-16 h-24 bg-gray-300 dark:bg-gray-600 rounded"></div>
                <div class="flex-1">
                  <div class="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                  <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else if watchlistAnalysis.recentlyAired.length > 0}
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {#each watchlistAnalysis.recentlyAired as entry}
            <AnimeCard
              forceListLayout={true}
              id={entry.anime?.id || entry.airingInfo?.id}
              style="episode"
              title={getAnimeTitle(entry.anime || entry.airingInfo, $preferencesStore.titleLanguage)}
              episodeTitle={entry.airingInfo.recentEpisode?.titleEn || entry.airingInfo.recentEpisode?.titleJp || "Unknown"}
              description={entry.anime?.description || ""}
              episodeLength={entry.anime?.duration?.replace(/per.+?$|per/gm, '') || "?"}
              episodeNumber={entry.airingInfo.recentEpisode?.episodeNumber?.toString() || "Unknown"}
              className="hover:cursor-pointer"
              year={entry.anime?.startDate ? new Date(entry.anime.startDate).getFullYear().toString() : "Unknown"}
              image={GetImageFromAnime(entry.anime || entry.airingInfo)}
              airdate={entry.airingInfo.nextEpisodeDate ? format(entry.airingInfo.nextEpisodeDate, "EEE MMM do") : "Unknown"}
              airTime={entry.airingInfo.airTimeDisplay}
              onClick={() => navigateToAnime(entry.anime?.id || entry.airingInfo?.id)}
              episodes={entry.anime?.episodeCount || 0}
            >
              <div slot="options">
                <AnimeStatusDropdown
                  entry={entry}
                  variant="compact"
                />
              </div>
            </AnimeCard>
          {/each}
        </div>
      {:else}
        <!-- Empty state for Recently Aired -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
          <i class="fas fa-clock-rotate-left text-4xl text-gray-400 dark:text-gray-600 mb-3 block"></i>
          <p class="text-gray-600 dark:text-gray-400">
            No recent episodes from your watchlist
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Episodes you've watched will appear here
          </p>
        </div>
      {/if}
    </section>
  </div>
</div>

<!-- Profile Image Upload Modal -->
<ProfileImageUpload
  isOpen={showUploadModal}
  currentImageUrl={userQuery && $userQuery.data ? $userQuery.data.profileImageUrl : null}
  {queryClient}
  on:close={() => showUploadModal = false}
/>
