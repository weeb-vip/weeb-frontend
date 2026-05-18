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
      completed: $completedQuery.data?.animes?.length || 0,
      dropped: $droppedQuery.data?.animes?.length || 0,
      onHold: $onHoldQuery.data?.animes?.length || 0,
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

<!-- Profile Banner -->
<div class="profile-banner"></div>

<!-- Profile Header (overlaps banner) -->
<header class="profile-header">
  <div class="profile-header-inner">
  {#if !mounted || !userQuery || (userQuery && $userQuery.isLoading)}
    <!-- Loading skeleton -->
    <div class="profile-avatar skeleton-pulse"></div>
    <div class="profile-info">
      <div class="skeleton-line" style="width:40%;height:24px;margin-bottom:8px"></div>
      <div class="skeleton-line" style="width:60%;height:14px"></div>
    </div>
  {:else if userQuery && $userQuery.data}
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
      <div class="profile-meta">
        {#if $userQuery.data.firstname || $userQuery.data.lastname}
          <span>{$userQuery.data.firstname} {$userQuery.data.lastname}</span>
          <span class="profile-meta-dot"></span>
        {/if}
        <span>Member</span>
      </div>
    </div>
    <div class="profile-actions">
      <a href="/settings" class="btn-settings">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        Settings
      </a>
    </div>
  {/if}
  </div>
</header>

<!-- Stats Strip -->
<div class="stats-strip">
  <a href="/profile/anime" class="stat-cell stat-cell--active">
    <div class="stat-number">{watchlistAnalysis.watching + watchlistAnalysis.completed + watchlistAnalysis.planToWatch + watchlistAnalysis.onHold + watchlistAnalysis.dropped}</div>
    <div class="stat-label">Total</div>
  </a>
  <a href="/profile/anime?status=WATCHING" class="stat-cell">
    <div class="stat-number" style="color:var(--weeb-green)">{watchlistAnalysis.watching}</div>
    <div class="stat-label"><span class="stat-dot" style="background:var(--weeb-green)"></span>Watching</div>
  </a>
  <a href="/profile/anime?status=COMPLETED" class="stat-cell">
    <div class="stat-number" style="color:var(--weeb-accent)">{watchlistAnalysis.completed}</div>
    <div class="stat-label"><span class="stat-dot" style="background:var(--weeb-accent)"></span>Completed</div>
  </a>
  <a href="/profile/anime?status=PLANTOWATCH" class="stat-cell">
    <div class="stat-number" style="color:var(--weeb-fg-secondary)">{watchlistAnalysis.planToWatch}</div>
    <div class="stat-label"><span class="stat-dot" style="background:var(--weeb-fg-muted)"></span>Plan to Watch</div>
  </a>
  <a href="/profile/anime?status=ONHOLD" class="stat-cell">
    <div class="stat-number" style="color:var(--weeb-amber)">{watchlistAnalysis.onHold}</div>
    <div class="stat-label"><span class="stat-dot" style="background:var(--weeb-amber)"></span>On Hold</div>
  </a>
  <a href="/profile/anime?status=DROPPED" class="stat-cell">
    <div class="stat-number" style="color:var(--weeb-red)">{watchlistAnalysis.dropped}</div>
    <div class="stat-label"><span class="stat-dot" style="background:var(--weeb-red)"></span>Dropped</div>
  </a>
</div>

<!-- Content Sections -->
<div class="profile-content">
  <!-- Currently Watching Section -->
  <section class="profile-section">
    <div class="section-header">
      <div class="section-header-left">
        <svg width="18" height="18" fill="none" stroke="var(--weeb-accent)" stroke-width="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
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
        <svg class="empty-state-icon" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M17 2l-5 5-5-5"/></svg>
        <p class="empty-state-text">You're not currently watching any anime</p>
        <p class="empty-state-sub">Start watching something new from your plan to watch list</p>
      </div>
    {/if}
  </section>

  <!-- Empty State -->
  {#if watchlistAnalysis.airingSoon.length === 0 && watchlistAnalysis.recentlyAired.length === 0 && (!watchlistAnalysis.currentlyWatching || watchlistAnalysis.currentlyWatching.length === 0)}
    <div class="empty-state empty-state--hero">
      <svg class="empty-state-icon empty-state-icon--lg" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
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
        <svg width="18" height="18" fill="none" stroke="var(--weeb-red)" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
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
        <svg class="empty-state-icon" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M15 14l-6 6M9 14l6 6"/></svg>
        <p class="empty-state-text">No episodes airing this week from your watchlist</p>
        <p class="empty-state-sub">Check back later or add more anime to your watchlist</p>
      </div>
    {/if}
  </section>

  <!-- Recently Aired Episodes Section -->
  <section class="profile-section">
    <div class="section-header">
      <div class="section-header-left">
        <svg width="18" height="18" fill="none" stroke="var(--weeb-green)" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
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
        <svg class="empty-state-icon" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l-3 3"/></svg>
        <p class="empty-state-text">No recent episodes from your watchlist</p>
        <p class="empty-state-sub">Episodes you've watched will appear here</p>
      </div>
    {/if}
  </section>
</div> <!-- .profile-content -->

<!-- Profile Image Upload Modal -->
<ProfileImageUpload
  isOpen={showUploadModal}
  currentImageUrl={userQuery && $userQuery.data ? $userQuery.data.profileImageUrl : null}
  {queryClient}
  on:close={() => showUploadModal = false}
/>

<style>
  /* ── Profile Banner ────────────────────────────────────────── */
  .profile-banner {
    position: relative;
    height: 200px;
    background: linear-gradient(135deg,
      color-mix(in oklch, var(--weeb-surface) 80%, var(--weeb-accent)) 0%,
      color-mix(in oklch, var(--weeb-bg-elevated) 70%, var(--weeb-violet, var(--weeb-accent-hover))) 50%,
      color-mix(in oklch, var(--weeb-bg) 80%, var(--weeb-accent)) 100%
    );
    overflow: hidden;
  }
  .profile-banner::before {
    content: '';
    position: absolute; inset: 0;
    background-image:
      linear-gradient(color-mix(in oklch, var(--weeb-fg) 3%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in oklch, var(--weeb-fg) 3%, transparent) 1px, transparent 1px);
    background-size: 60px 60px;
    z-index: 0;
  }
  .profile-banner::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(to bottom, transparent 40%, var(--weeb-bg) 100%);
    z-index: 1;
  }

  /* ── Profile Header (overlaps banner) ──────────────────────── */
  .profile-header {
    position: relative;
    margin-top: -64px;
    padding: 0 var(--weeb-section-px, 48px);
    z-index: 2;
  }
  .profile-header-inner {
    display: flex;
    align-items: flex-end;
    gap: 24px;
  }

  .profile-avatar-wrap {
    position: relative;
    flex-shrink: 0;
  }
  .profile-avatar {
    width: 120px; height: 120px;
    border-radius: 50%;
    border: 4px solid var(--weeb-bg);
    background: linear-gradient(135deg,
      var(--weeb-accent) 0%,
      var(--weeb-violet, var(--weeb-accent-hover)) 50%,
      color-mix(in oklch, var(--weeb-violet, var(--weeb-accent-hover)) 60%, var(--weeb-accent)) 100%
    );
    flex-shrink: 0;
    box-shadow: 0 8px 32px color-mix(in oklch, black 50%, transparent);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .profile-avatar-img { width: 100%; height: 100%; object-fit: cover; }
  .profile-avatar-letter { font-size: 2.5rem; font-weight: 700; color: #fff; }
  .profile-avatar-overlay {
    position: absolute; inset: 0;
    border-radius: 50%;
    background: color-mix(in oklch, black 50%, transparent);
    opacity: 0; transition: opacity 0.2s;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: none;
    color: #fff;
  }
  .profile-avatar-wrap:hover .profile-avatar-overlay { opacity: 1; }

  .profile-info {
    flex: 1; min-width: 0;
    padding-bottom: 4px;
  }
  .profile-name {
    font-size: 1.75rem; font-weight: 700;
    letter-spacing: -0.03em; line-height: 1.2;
    color: var(--weeb-fg);
    margin-bottom: 4px;
  }
  .profile-meta {
    font-size: 0.8rem; color: var(--weeb-fg-muted);
    display: flex; align-items: center; gap: 12px;
  }
  .profile-meta-dot {
    width: 3px; height: 3px; border-radius: 50%;
    background: var(--weeb-fg-muted);
  }

  .profile-actions {
    display: flex; gap: 8px; flex-shrink: 0;
    padding-bottom: 8px;
  }
  .btn-settings {
    height: 34px; padding: 0 16px;
    background: var(--weeb-surface); border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px); color: var(--weeb-fg-secondary);
    font-size: 0.8rem; font-weight: 500; cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    transition: border-color 0.15s, color 0.15s;
    text-decoration: none;
    font-family: inherit;
  }
  .btn-settings:hover { border-color: var(--weeb-accent); color: var(--weeb-fg); }

  /* ── Stats strip ───────────────────────────────────────────── */
  .stats-strip {
    display: flex; gap: 0;
    margin: 24px var(--weeb-section-px, 48px) 0;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    overflow: hidden;
  }
  .stat-cell {
    flex: 1;
    padding: 16px 12px;
    text-align: center;
    background: var(--weeb-surface);
    cursor: pointer;
    transition: background 0.15s;
    position: relative;
    text-decoration: none;
    color: inherit;
  }
  .stat-cell + .stat-cell { border-left: 1px solid var(--weeb-border); }
  .stat-cell:hover { background: var(--weeb-surface-hover); }
  .stat-cell--active {
    background: color-mix(in oklch, var(--weeb-accent) 8%, transparent);
  }
  .stat-cell--active::after {
    content: '';
    position: absolute; bottom: 0; left: 0; right: 0;
    height: 2px;
    background: var(--weeb-accent);
  }
  .stat-number {
    font-size: 1.5rem; font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em; line-height: 1.2;
    color: var(--weeb-fg);
  }
  .stat-label {
    font-size: 0.7rem; color: var(--weeb-fg-muted);
    text-transform: uppercase; letter-spacing: 0.05em;
    font-weight: 500; margin-top: 2px;
  }
  .stat-dot {
    display: inline-block;
    width: 6px; height: 6px; border-radius: 50%;
    margin-right: 4px; vertical-align: middle;
  }

  /* ── Content area ─────────────────────────────────────────── */
  .profile-content {
    padding: 32px var(--weeb-section-px, 48px) 64px;
  }

  .profile-section { margin-bottom: 40px; }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .section-header-left {
    display: flex; align-items: center; gap: 10px;
  }
  .section-title {
    font-size: 1.25rem; font-weight: 600;
    color: var(--weeb-fg); letter-spacing: -0.01em;
  }
  .section-count {
    font-size: 0.75rem; font-weight: 600;
    padding: 2px 8px; border-radius: 99px;
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
    font-size: 0.85rem; font-weight: 500;
    color: var(--weeb-accent);
    text-decoration: none; transition: color 0.15s;
  }
  .section-link:hover { color: var(--weeb-accent-hover); }

  /* ── Anime grid ─────────────────────────────────────────────── */
  .anime-grid { display: grid; gap: 16px; }
  .anime-grid--3col {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  .anime-grid--3col > :global(*) { max-width: 200px; }

  /* ── Empty state ────────────────────────────────────────────── */
  .empty-state {
    background: var(--weeb-bg-elevated, var(--weeb-surface));
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    padding: 40px 24px; text-align: center;
  }
  .empty-state--hero { padding: 64px 24px; margin-bottom: 40px; }
  .empty-state-icon {
    color: var(--weeb-fg-muted);
    display: block; margin: 0 auto 12px;
  }
  .empty-state-icon--lg { margin-bottom: 16px; }
  .empty-state-heading {
    font-size: 1.25rem; font-weight: 600;
    color: var(--weeb-fg); margin-bottom: 8px;
  }
  .empty-state-text { font-size: 0.9rem; color: var(--weeb-fg-muted); }
  .empty-state-sub { font-size: 0.8rem; color: var(--weeb-fg-muted); margin-top: 8px; }
  .empty-state-cta {
    display: inline-flex; align-items: center; gap: 8px;
    margin-top: 20px; padding: 10px 24px;
    background: var(--weeb-accent); color: #fff;
    font-size: 0.875rem; font-weight: 600;
    border-radius: var(--weeb-radius, 8px);
    text-decoration: none; transition: background 0.15s;
  }
  .empty-state-cta:hover { background: var(--weeb-accent-hover); }

  /* ── Skeleton loading ───────────────────────────────────────── */
  .skeleton-pulse { animation: skeleton-shimmer 1.5s ease-in-out infinite; }
  @keyframes skeleton-shimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .skeleton-line {
    background: var(--weeb-surface-hover, var(--weeb-surface));
    border-radius: 6px;
    height: 14px;
  }
  .skeleton-line--lg { width: 60%; height: 20px; margin-bottom: 8px; }
  .skeleton-line--md { width: 75%; height: 14px; margin-bottom: 6px; }
  .skeleton-line--sm { width: 40%; height: 12px; margin-bottom: 6px; }
  .skeleton-line--xs { width: 60px; height: 12px; }
  .skeleton-card {
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    overflow: hidden;
  }
  .skeleton-poster {
    width: 100%;
    aspect-ratio: 2 / 3;
    background: var(--weeb-surface-hover, var(--weeb-surface));
  }
  .skeleton-card-body { padding: 14px; }

  /* ── Responsive: 1024px ────────────────────────────────────── */
  @media (max-width: 1024px) {
    .anime-grid--3col {
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    }
  }

  /* ── Responsive: 768px ─────────────────────────────────────── */
  @media (max-width: 768px) {
    .profile-banner { height: 140px; }
    .profile-header { margin-top: -48px; padding: 0 16px; }
    .profile-header-inner { gap: 16px; }
    .profile-avatar { width: 88px; height: 88px; border-width: 3px; }
    .profile-avatar-letter { font-size: 2rem; }
    .profile-name { font-size: 1.35rem; }
    .profile-actions { display: none; }
    .stats-strip { margin: 16px 16px 0; }
    .stat-cell { padding: 12px 8px; }
    .stat-number { font-size: 1.1rem; }
    .stat-label { font-size: 0.6rem; }
    .profile-content { padding: 24px 16px 48px; }
    .profile-section { margin-bottom: 24px; }
    .anime-grid--3col {
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 10px;
    }
  }

  /* ── Responsive: 480px ─────────────────────────────────────── */
  @media (max-width: 480px) {
    .profile-banner { height: 120px; }
    .profile-header { margin-top: -40px; }
    .profile-avatar { width: 72px; height: 72px; }
    .profile-avatar-letter { font-size: 1.5rem; }
    .profile-name { font-size: 1.15rem; }
    .stats-strip { flex-wrap: wrap; }
    .stat-cell { flex: 1 1 33.33%; min-width: 0; }
    .stat-cell:nth-child(4),
    .stat-cell:nth-child(5),
    .stat-cell:nth-child(6) { border-top: 1px solid var(--weeb-border); }
    .anime-grid--3col {
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
  }
</style>
