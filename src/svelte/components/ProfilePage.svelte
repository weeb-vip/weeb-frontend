<script lang="ts">
  import { onMount } from 'svelte';
  import { createQuery, createMutation } from '@tanstack/svelte-query';
  import { format } from 'date-fns';
  import { initializeQueryClient } from '../services/query-client';
  import { getUser, fetchUserAnimes, fetchCurrentlyAiringWithDatesAndEpisodes } from '../../services/queries';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';
  import { getAirTimeDisplay, findNextEpisode, getCurrentTime, parseAirTime } from '../../services/airTimeUtils';
  import Button from './Button.svelte';
  import PosterCard from './PosterCard.svelte';
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

<div class="profile-page">
  {#if !mounted || !userQuery || (userQuery && $userQuery.isLoading)}
    <!-- Loading skeleton -->
    <div class="profile-header skeleton-pulse">
      <div class="profile-avatar skeleton-block"></div>
      <div class="profile-info">
        <div class="skeleton-line skeleton-line--lg"></div>
        <div class="skeleton-line skeleton-line--sm"></div>
        <div class="profile-stats">
          {#each Array(5) as _}
            <div class="skeleton-line skeleton-line--xs"></div>
          {/each}
        </div>
      </div>
    </div>

    <div class="stats-cards">
      {#each Array(4) as _}
        <div class="stats-card skeleton-pulse">
          <div class="skeleton-line skeleton-line--lg"></div>
          <div class="skeleton-line skeleton-line--sm"></div>
        </div>
      {/each}
    </div>
  {:else if userQuery && $userQuery.data}
    <!-- Profile Header -->
    <header class="profile-header">
      <div class="profile-avatar-wrap">
        <div class="profile-avatar">
          {#if $userQuery.data.profileImageUrl}
            <img
              src={getProfileImageUrl($userQuery.data.profileImageUrl)}
              alt={$userQuery.data.username}
              class="profile-avatar-img"
            />
          {:else}
            <span class="profile-avatar-letter">
              {$userQuery.data.username.charAt(0).toUpperCase()}
            </span>
          {/if}
        </div>
        <button
          on:click={() => showUploadModal = true}
          class="profile-avatar-overlay"
          aria-label="Change profile picture"
        >
          <span>Change</span>
        </button>
      </div>
      <div class="profile-info">
        <h1 class="profile-name">{$userQuery.data.username}</h1>
        <p class="profile-meta">
          {#if $userQuery.data.firstname || $userQuery.data.lastname}
            {$userQuery.data.firstname} {$userQuery.data.lastname}
          {/if}
        </p>
        <div class="profile-stats">
          <div class="stat-item">
            <span class="stat-dot" style="background:var(--weeb-green)"></span>
            <span class="stat-label">Watching</span>
            <span class="stat-count">{watchlistAnalysis.watching}</span>
          </div>
          <div class="stat-item">
            <span class="stat-dot" style="background:var(--weeb-accent)"></span>
            <span class="stat-label">Completed</span>
            <span class="stat-count">{watchlistAnalysis.completed}</span>
          </div>
          <div class="stat-item">
            <span class="stat-dot" style="background:var(--weeb-fg-muted)"></span>
            <span class="stat-label">Plan to Watch</span>
            <span class="stat-count">{watchlistAnalysis.planToWatch}</span>
          </div>
          <div class="stat-item">
            <span class="stat-dot" style="background:var(--weeb-amber)"></span>
            <span class="stat-label">On Hold</span>
            <span class="stat-count">{watchlistAnalysis.onHold}</span>
          </div>
          <div class="stat-item">
            <span class="stat-dot" style="background:var(--weeb-red)"></span>
            <span class="stat-label">Dropped</span>
            <span class="stat-count">{watchlistAnalysis.dropped}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Stats Cards -->
    <div class="stats-cards">
      <div class="stats-card">
        <div class="stats-card-number">
          {watchlistAnalysis.watching + watchlistAnalysis.completed + watchlistAnalysis.planToWatch + watchlistAnalysis.onHold + watchlistAnalysis.dropped}
        </div>
        <div class="stats-card-label">Total Anime</div>
      </div>
      <div class="stats-card">
        <div class="stats-card-number">
          {($watchingQuery && $watchingQuery.data?.total) || 0}
        </div>
        <div class="stats-card-label">Watching</div>
      </div>
      <div class="stats-card">
        <div class="stats-card-number">
          {watchlistAnalysis.airingSoon.length}
        </div>
        <div class="stats-card-label">Airing This Week</div>
      </div>
      <div class="stats-card">
        <div class="stats-card-number">
          {watchlistAnalysis.recentlyAired.length}
        </div>
        <div class="stats-card-label">Recent Episodes</div>
      </div>
    </div>
  {/if}

  <!-- Currently Watching Section -->
  <section class="profile-section">
    <div class="section-header">
      <div class="section-header-left">
        <i class="fas fa-play section-icon section-icon--accent"></i>
        <h2 class="section-title">Currently Watching</h2>
        {#if !watchlistAnalysis.isLoading && watchlistAnalysis.currentlyWatching && watchlistAnalysis.currentlyWatching.length > 0}
          <span class="section-count section-count--accent">
            {watchlistAnalysis.currentlyWatching.length}
          </span>
        {/if}
      </div>
      {#if !watchlistAnalysis.isLoading && watchlistAnalysis.watching > 0}
        <a href="/profile/anime" class="section-link">View All</a>
      {/if}
    </div>

    {#if watchlistAnalysis.isLoading}
      <div class="anime-grid anime-grid--3col">
        {#each Array(6) as _}
          <div class="skeleton-card skeleton-pulse">
            <div class="skeleton-poster"></div>
            <div class="skeleton-card-body">
              <div class="skeleton-line skeleton-line--lg"></div>
              <div class="skeleton-line skeleton-line--md"></div>
              <div class="skeleton-line skeleton-line--sm"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if watchlistAnalysis.currentlyWatching && watchlistAnalysis.currentlyWatching.length > 0}
      <div class="anime-grid anime-grid--3col">
        {#each watchlistAnalysis.currentlyWatching as entry}
          <PosterCard
            id={entry.anime?.id}
            title={getAnimeTitle(entry.anime, $preferencesStore.titleLanguage)}
            image={GetImageFromAnime(entry.anime)}
            score={entry.anime?.rating && entry.anime?.rating !== 'N/A' ? parseFloat(entry.anime.rating) : null}
            status={entry.anime?.status || null}
            sub={entry.anime?.episodeCount ? `${entry.anime.episodeCount} episodes` : ''}
            genres={entry.anime?.tags || []}
            description={entry.anime?.description || ''}
            episodeCount={entry.anime?.episodeCount}
            onList={entry.status || 'watching'}
          />
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <i class="fas fa-tv empty-state-icon"></i>
        <p class="empty-state-text">You're not currently watching any anime</p>
        <p class="empty-state-sub">Start watching something new from your plan to watch list</p>
      </div>
    {/if}
  </section>

  <!-- Empty State -->
  {#if watchlistAnalysis.airingSoon.length === 0 && watchlistAnalysis.recentlyAired.length === 0 && (!watchlistAnalysis.currentlyWatching || watchlistAnalysis.currentlyWatching.length === 0)}
    <div class="empty-state empty-state--hero">
      <i class="fas fa-bookmark empty-state-icon empty-state-icon--lg"></i>
      <h3 class="empty-state-heading">Your watchlist is empty</h3>
      <p class="empty-state-text">
        Start adding anime to your watchlist to see personalized recommendations and airing schedules.
      </p>
      <a href="/" class="empty-state-cta">Explore Anime</a>
    </div>
  {/if}

  <!-- Airing This Week Section -->
  <section class="profile-section">
    <div class="section-header">
      <div class="section-header-left">
        <i class="fas fa-play section-icon section-icon--red"></i>
        <h2 class="section-title">Airing This Week</h2>
        {#if !watchlistAnalysis.isLoading && watchlistAnalysis.airingSoon.length > 0}
          <span class="section-count section-count--red">
            {watchlistAnalysis.airingSoon.length}
          </span>
        {/if}
      </div>
    </div>

    {#if watchlistAnalysis.isLoading}
      <div class="anime-grid anime-grid--3col">
        {#each Array(3) as _}
          <div class="skeleton-card skeleton-pulse">
            <div class="skeleton-poster"></div>
            <div class="skeleton-card-body">
              <div class="skeleton-line skeleton-line--lg"></div>
              <div class="skeleton-line skeleton-line--md"></div>
              <div class="skeleton-line skeleton-line--sm"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if watchlistAnalysis.airingSoon.length > 0}
      <div class="anime-grid anime-grid--3col">
        {#each watchlistAnalysis.airingSoon as entry}
          <PosterCard
            id={entry.anime?.id || entry.airingInfo?.id}
            title={getAnimeTitle(entry.anime || entry.airingInfo, $preferencesStore.titleLanguage)}
            image={GetImageFromAnime(entry.anime || entry.airingInfo)}
            score={entry.anime?.rating && entry.anime?.rating !== 'N/A' ? parseFloat(entry.anime.rating) : null}
            status={entry.anime?.status || null}
            sub={entry.anime?.episodeCount ? `${entry.anime.episodeCount} episodes` : ''}
            genres={entry.anime?.tags || entry.airingInfo?.tags || []}
            description={entry.anime?.description || ''}
            episodeCount={entry.anime?.episodeCount}
            onList={entry.status || 'watching'}
          />
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <i class="fas fa-calendar-xmark empty-state-icon"></i>
        <p class="empty-state-text">No episodes airing this week from your watchlist</p>
        <p class="empty-state-sub">Check back later or add more anime to your watchlist</p>
      </div>
    {/if}
  </section>

  <!-- Recently Aired Episodes Section -->
  <section class="profile-section">
    <div class="section-header">
      <div class="section-header-left">
        <i class="fas fa-calendar-days section-icon section-icon--green"></i>
        <h2 class="section-title">Recently Aired Episodes</h2>
        {#if !watchlistAnalysis.isLoading && watchlistAnalysis.recentlyAired.length > 0}
          <span class="section-count section-count--green">
            {watchlistAnalysis.recentlyAired.length}
          </span>
        {/if}
      </div>
    </div>

    {#if watchlistAnalysis.isLoading}
      <div class="anime-grid anime-grid--3col">
        {#each Array(3) as _}
          <div class="skeleton-card skeleton-pulse">
            <div class="skeleton-poster"></div>
            <div class="skeleton-card-body">
              <div class="skeleton-line skeleton-line--lg"></div>
              <div class="skeleton-line skeleton-line--md"></div>
              <div class="skeleton-line skeleton-line--sm"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if watchlistAnalysis.recentlyAired.length > 0}
      <div class="anime-grid anime-grid--3col">
        {#each watchlistAnalysis.recentlyAired as entry}
          <PosterCard
            id={entry.anime?.id || entry.airingInfo?.id}
            title={getAnimeTitle(entry.anime || entry.airingInfo, $preferencesStore.titleLanguage)}
            image={GetImageFromAnime(entry.anime || entry.airingInfo)}
            score={entry.anime?.rating && entry.anime?.rating !== 'N/A' ? parseFloat(entry.anime.rating) : null}
            status={entry.anime?.status || null}
            sub={entry.anime?.episodeCount ? `${entry.anime.episodeCount} episodes` : ''}
            genres={entry.anime?.tags || entry.airingInfo?.tags || []}
            description={entry.anime?.description || ''}
            episodeCount={entry.anime?.episodeCount}
            onList={entry.status || 'watching'}
          />
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <i class="fas fa-clock-rotate-left empty-state-icon"></i>
        <p class="empty-state-text">No recent episodes from your watchlist</p>
        <p class="empty-state-sub">Episodes you've watched will appear here</p>
      </div>
    {/if}
  </section>
</div>

<!-- Profile Image Upload Modal -->
<ProfileImageUpload
  isOpen={showUploadModal}
  currentImageUrl={userQuery && $userQuery.data ? $userQuery.data.profileImageUrl : null}
  {queryClient}
  on:close={() => showUploadModal = false}
/>

<style>
  /* ── Page container ──────────────────────────────────────────── */
  .profile-page {
    width: 100%;
    padding: 48px var(--weeb-section-px, 48px) 64px;
  }

  /* ── Profile header ──────────────────────────────────────────── */
  .profile-header {
    display: flex;
    align-items: flex-start;
    gap: 32px;
    padding-bottom: 40px;
    border-bottom: 1px solid var(--weeb-border);
    margin-bottom: 32px;
  }

  .profile-avatar-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .profile-avatar {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--weeb-accent) 0%, var(--weeb-violet, var(--weeb-accent-hover)) 50%, var(--weeb-accent) 100%);
    flex-shrink: 0;
    box-shadow: 0 4px 24px color-mix(in oklch, var(--weeb-accent) 30%, transparent);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .profile-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .profile-avatar-letter {
    font-size: 2rem;
    font-weight: 700;
    color: #fff;
  }

  .profile-avatar-overlay {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    opacity: 0;
    transition: opacity 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: none;
    color: #fff;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .profile-avatar-wrap:hover .profile-avatar-overlay {
    opacity: 1;
  }

  .profile-info {
    flex: 1;
    min-width: 0;
  }

  .profile-name {
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--weeb-fg);
    line-height: 1.2;
    margin-bottom: 4px;
  }

  .profile-meta {
    font-size: 0.85rem;
    color: var(--weeb-fg-muted);
    margin-bottom: 20px;
  }

  .profile-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    align-items: center;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.875rem;
  }

  .stat-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .stat-label {
    color: var(--weeb-fg-muted);
  }

  .stat-count {
    font-weight: 600;
    color: var(--weeb-fg);
    font-variant-numeric: tabular-nums;
  }

  /* ── Stats cards ─────────────────────────────────────────────── */
  .stats-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 40px;
  }

  .stats-card {
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: 12px;
    padding: 20px 24px;
    text-align: center;
    transition: border-color 0.15s;
  }

  .stats-card:hover {
    border-color: var(--weeb-accent);
  }

  .stats-card-number {
    font-size: 2rem;
    font-weight: 700;
    color: var(--weeb-fg);
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  .stats-card-label {
    font-size: 0.8rem;
    color: var(--weeb-fg-muted);
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 500;
  }

  /* ── Section layout ──────────────────────────────────────────── */
  .profile-section {
    margin-bottom: 40px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .section-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .section-icon {
    font-size: 1.15rem;
  }

  .section-icon--accent {
    color: var(--weeb-accent);
  }

  .section-icon--red {
    color: var(--weeb-red);
  }

  .section-icon--green {
    color: var(--weeb-green);
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--weeb-fg);
    letter-spacing: -0.01em;
  }

  .section-count {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 99px;
    font-variant-numeric: tabular-nums;
  }

  .section-count--accent {
    background: color-mix(in oklch, var(--weeb-accent) 15%, transparent);
    color: var(--weeb-accent);
  }

  .section-count--red {
    background: color-mix(in oklch, var(--weeb-red) 15%, transparent);
    color: var(--weeb-red);
  }

  .section-count--green {
    background: color-mix(in oklch, var(--weeb-green) 15%, transparent);
    color: var(--weeb-green);
  }

  .section-link {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--weeb-accent);
    text-decoration: none;
    transition: color 0.15s;
  }

  .section-link:hover {
    color: var(--weeb-accent-hover);
  }

  /* ── Anime grid ──────────────────────────────────────────────── */
  .anime-grid {
    display: grid;
    gap: 16px;
  }

  .anime-grid--3col {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }

  .anime-grid--3col > :global(*) {
    max-width: 220px;
  }

  /* ── Empty state ─────────────────────────────────────────────── */
  .empty-state {
    background: var(--weeb-bg-elevated, var(--weeb-surface));
    border: 1px solid var(--weeb-border);
    border-radius: 12px;
    padding: 40px 24px;
    text-align: center;
  }

  .empty-state--hero {
    padding: 64px 24px;
    margin-bottom: 40px;
  }

  .empty-state-icon {
    font-size: 2.5rem;
    color: var(--weeb-fg-muted);
    display: block;
    margin-bottom: 12px;
  }

  .empty-state-icon--lg {
    font-size: 3.5rem;
    margin-bottom: 16px;
  }

  .empty-state-heading {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--weeb-fg);
    margin-bottom: 8px;
  }

  .empty-state-text {
    font-size: 0.9rem;
    color: var(--weeb-fg-muted);
  }

  .empty-state-sub {
    font-size: 0.8rem;
    color: var(--weeb-fg-muted);
    margin-top: 8px;
  }

  .empty-state-cta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 20px;
    padding: 10px 24px;
    background: var(--weeb-accent);
    color: #fff;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    text-decoration: none;
    transition: background 0.15s;
  }

  .empty-state-cta:hover {
    background: var(--weeb-accent-hover);
  }

  /* ── Skeleton loading ────────────────────────────────────────── */
  .skeleton-pulse {
    animation: skeleton-shimmer 1.5s ease-in-out infinite;
  }

  @keyframes skeleton-shimmer {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .skeleton-block {
    background: var(--weeb-surface-hover, var(--weeb-surface));
    border-radius: 50%;
  }

  .skeleton-line {
    background: var(--weeb-surface-hover, var(--weeb-surface));
    border-radius: 6px;
    height: 14px;
  }

  .skeleton-line--lg {
    width: 60%;
    height: 20px;
    margin-bottom: 8px;
  }

  .skeleton-line--md {
    width: 75%;
    height: 14px;
    margin-bottom: 6px;
  }

  .skeleton-line--sm {
    width: 40%;
    height: 12px;
    margin-bottom: 6px;
  }

  .skeleton-line--xs {
    width: 60px;
    height: 12px;
  }

  .skeleton-card {
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: 12px;
    overflow: hidden;
  }

  .skeleton-poster {
    width: 100%;
    height: 80px;
    background: var(--weeb-surface-hover, var(--weeb-surface));
  }

  .skeleton-card-body {
    padding: 14px;
  }

  /* ── Responsive ──────────────────────────────────────────────── */
  @media (max-width: 1024px) {
    .anime-grid--3col {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    }
  }

  @media (max-width: 768px) {
    .profile-page {
      padding: 24px 16px 48px;
    }

    .profile-header {
      flex-wrap: wrap;
      gap: 20px;
    }

    .profile-avatar {
      width: 64px;
      height: 64px;
    }

    .profile-name {
      font-size: 1.5rem;
    }

    .stats-cards {
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .stats-card {
      padding: 14px 16px;
    }

    .stats-card-number {
      font-size: 1.5rem;
    }

    .anime-grid--3col {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    }
  }

  @media (max-width: 480px) {
    .profile-stats {
      gap: 12px;
    }

    .stats-cards {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
