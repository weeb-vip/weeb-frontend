<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { createQuery, createMutation } from '@tanstack/svelte-query';
  import { format } from 'date-fns';
  import { initializeQueryClient } from '../services/query-client';
  import { getUser, fetchUserAnimes, fetchUserAnimeStatusCounts, fetchUserWorkStatusCounts, fetchUserWorks, fetchCurrentlyAiringWithDatesAndEpisodes } from '../../services/queries';
  import { GetImageFromAnime, getYearUTC, animeHref } from '../../services/utils';
  import { getAirTimeDisplay, findNextEpisode, getCurrentTime, parseAirTime } from '../../services/airTimeUtils';
  import Button from './Button.svelte';
  import PosterCard from './PosterCard.svelte';
  import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
  import ProfileImageUpload from './ProfileImageUpload.svelte';
  import PosterGrid from './PosterGrid.svelte';
  import '@fortawesome/fontawesome-free/css/all.min.css';
  import { configStore } from '../stores/config';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';
  import { Status, WorkStatus } from '../../gql/graphql';
  import { workSubtitle } from '../../utils/workDisplay';

  /** Prefetched on the server by +page.server.ts. */
  export let ssr: any = null;

  // Initialize query client
  const queryClient = initializeQueryClient();

  // State
  let showUploadModal = false;
  let showBannerModal = false;
  let bannerError = false;
  /** Set when the avatar image fails to load, so the initial can stand in for
      it. Without this a stale or missing profileImageUrl left a broken <img>
      in place: the URL is truthy, so the initial branch never ran, and the
      avatar rendered as nothing at all. */
  let avatarImageError = false;
  let mounted = false;

  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const airingStart = ssr?.startDate ? new Date(ssr.startDate) : new Date(Date.now() - WEEK);
  const airingEnd = ssr?.endDate ? new Date(ssr.endDate) : new Date(Date.now() + WEEK);

  // Created here rather than in onMount.
  //
  // onMount does not run during SSR, so every one of these was created only
  // after hydration -- and behind an `await configStore.init()` at that. The
  // server rendered a skeleton, the browser parsed it, booted, awaited config,
  // and only then began seven requests. Nothing on the page existed until they
  // came back.
  //
  // With initialData from the server load they resolve immediately and the
  // markup ships filled in. The queryFn stays, so a client-side navigation to
  // this route still fetches normally.
  const userQuery = createQuery(
    { ...getUser(), initialData: ssr?.user ?? undefined },
    queryClient
  );
  const watchingQuery = createQuery(
    {
      // Six, because six cards are rendered. These are the only entries whose
      // episodes are read -- for the next-episode line on each card.
      ...fetchUserAnimes({ input: { status: Status.Watching, limit: 6, page: 1 } }),
      initialData: ssr?.watching ?? undefined
    },
    queryClient
  );
  // Reading, for the Currently Reading row. Twelve, matching what the row
  // renders; its total comes from the work counts below rather than from the
  // length of this page.
  const readingQuery = createQuery(
    {
      ...fetchUserWorks({ input: { status: WorkStatus.Reading, limit: 12, page: 1 } }),
      initialData: ssr?.reading ?? undefined
    },
    queryClient
  );

  // Every status in one request each, which is what /profile/anime already
  // does. These replaced three separate count queries and retired the
  // plan-to-watch list outright: its thousand entries existed to produce a
  // total and a set of ids, and both are cheaper elsewhere -- the total here,
  // the ids from currentlyAiring's own userAnime field.
  //
  // The lists behind these numbers are not fetched. A dashboard showing "412
  // completed" has no use for 412 rows, and the rows are expensive: every
  // entry carries its anime and every episode of it, synopses included.
  const animeCountsQuery = createQuery(
    { ...fetchUserAnimeStatusCounts(), initialData: ssr?.animeCounts ?? undefined },
    queryClient
  );
  const workCountsQuery = createQuery(
    { ...fetchUserWorkStatusCounts(), initialData: ssr?.workCounts ?? undefined },
    queryClient
  );
  const currentlyAiringQuery = createQuery(
    {
      ...fetchCurrentlyAiringWithDatesAndEpisodes(airingStart, airingEnd),
      initialData: ssr?.currentlyAiring ?? undefined
    },
    queryClient
  );

  function getProfileImageUrl(profileImageUrl: string | null): string | undefined {
    if (!profileImageUrl) return undefined;
    const config = configStore.get();
    const cdnUserUrl = config?.cdn_user_url || 'https://cdn.weeb.vip/weeb-user-staging';
    // The hero avatar is shown large, so it uses the full-quality original
    // rather than the 64px thumbnail the nav uses -- a 64px image scaled up to
    // this size is visibly soft. The original is what the upload stored.
    return `${cdnUserUrl}/${profileImageUrl}`;
  }

  function getBannerImageUrl(bannerImageUrl: string | null | undefined): string | undefined {
    if (!bannerImageUrl) return undefined;
    const config = configStore.get();
    const cdnUserUrl = config?.cdn_user_url || 'https://cdn.weeb.vip/weeb-user-staging';
    // Banners are shown at one large size, so always the full-quality original.
    return `${cdnUserUrl}/${bannerImageUrl}`;
  }

  onMount(async () => {
    mounted = true;
    // Still needed for the upload widget and the CDN base, but nothing waits
    // on it to render any more -- the queries above are already resolved.
    await configStore.init();
  });

  // Process watchlist and airing data
  // Reading, kept out of watchlistAnalysis on purpose: that block is the anime
  // dashboard's own computation, and threading a second medium through it would
  // couple two things that only share a page. Works without a slug are dropped
  // -- the scraper assigns those on its own schedule and an unlinkable card is
  // worse than a shorter row.
  $: readingWorks = ($readingQuery.data?.works ?? []).filter((e) => e?.work?.urlSlug);
  $: readingTotal = Number($workCountsQuery.data?.reading ?? $readingQuery.data?.total ?? readingWorks.length);

  $: watchlistAnalysis = (() => {
    if (!$userQuery) {
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
    const isLoading = $watchingQuery.isLoading || $currentlyAiringQuery.isLoading;

    const watching = $watchingQuery.data?.animes || [];
    const currentlyAiringShows = $currentlyAiringQuery.data?.currentlyAiring || [];

    // Create lookup map of currently airing shows by ID
    const airingMap = new Map();
    currentlyAiringShows.forEach(anime => {
      if (anime) {
        airingMap.set(anime.id, anime);
      }
    });

    // The watchlist entries among the shows airing in this window, built from
    // the airing payload rather than from the watchlist.
    //
    // Both loops below want the same thing: the intersection of the viewer's
    // list with these 25 shows. currentlyAiring already carries userAnime per
    // show, so the intersection is a filter over 25 rather than a Set built
    // from a thousand rows -- the same trick the homepage uses for "airing from
    // your list". Shaped like a watchlist entry so everything downstream reads
    // unchanged.
    //
    // Watching and plan-to-watch only, matching what the two lists used to
    // contain: a completed or dropped show airing this week is not something
    // the dashboard was ever surfacing.
    const ON_LIST = new Set(['WATCHING', 'PLANTOWATCH']);
    const allWatchlistShows = currentlyAiringShows
      .filter((anime: any) => anime?.userAnime && ON_LIST.has(String(anime.userAnime.status).toUpperCase()))
      .map((anime: any) => ({ ...anime.userAnime, anime }));
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
      // total, not the array length: the arrays are capped by the page limit,
      // so counting them under-reports any list longer than a page.
      //
      // Number(), because total is Int64 in the schema and gqlgen marshals
      // that to a JSON string (marshalNInt642string) to stay clear of
      // JavaScript's 53-bit integer limit. Left as strings, the summed TOTAL
      // tile concatenates instead of adding: 6, 53, 294, 1, 1 rendered as
      // 65329411. Codegen types Int64 as `any`, so nothing catches this.
      watching: Number($animeCountsQuery.data?.watching ?? watching.length),
      planToWatch: Number($animeCountsQuery.data?.planToWatch ?? 0),
      completed: Number($animeCountsQuery.data?.completed ?? 0),
      dropped: Number($animeCountsQuery.data?.dropped ?? 0),
      onHold: Number($animeCountsQuery.data?.onHold ?? 0),
      airingSoon: airingSoon.slice(0, 12),
      recentlyAired: recentlyAired.slice(0, 6),
      currentlyWatching,
      isLoading
    };
  })();

  function navigateToAnime(anime: { id?: string | null; slug?: string | null } | null | undefined) {
    goto(animeHref(anime));
  }
</script>

<!-- Profile Banner -->
<div class="profile-banner">
  {#if userQuery && $userQuery.data?.bannerImageUrl && !bannerError}
    <img
      class="profile-banner-img"
      src={getBannerImageUrl($userQuery.data.bannerImageUrl)}
      alt=""
      on:error={() => (bannerError = true)}
    />
  {/if}
  <button
    type="button"
    class="profile-banner-edit"
    on:click={() => { bannerError = false; showBannerModal = true; }}
    aria-label="Change banner image"
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
    </svg>
    <span>Change banner</span>
  </button>
</div>

<!-- Profile Header (overlaps banner) -->
<header class="profile-header">
  <div class="profile-header-inner">
  {#if $userQuery.isLoading && !$userQuery.data}
    <!-- Loading skeleton -->
    <div class="profile-avatar skeleton-pulse"></div>
    <div class="profile-info">
      <div class="skeleton-line" style="width:40%;height:24px;margin-bottom:8px"></div>
      <div class="skeleton-line" style="width:60%;height:14px"></div>
    </div>
  {:else if userQuery && $userQuery.data}
    <div class="profile-avatar-wrap">
      <div class="profile-avatar">
        {#if $userQuery.data.profileImageUrl && !avatarImageError}
          <img
            src={getProfileImageUrl($userQuery.data.profileImageUrl)}
            alt={$userQuery.data.username}
            class="profile-avatar-img"
            on:error={() => (avatarImageError = true)}
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
  <a href="/profile/anime?medium=manga&status=READING" class="stat-cell">
    <div class="stat-number" style="color:var(--weeb-purple, var(--weeb-accent))">{readingTotal}</div>
    <div class="stat-label"><span class="stat-dot" style="background:var(--weeb-purple, var(--weeb-accent))"></span>Reading</div>
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
      <PosterGrid>
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
      </PosterGrid>
    {:else if watchlistAnalysis.currentlyWatching && watchlistAnalysis.currentlyWatching.length > 0}
      <PosterGrid>
        {#each watchlistAnalysis.currentlyWatching as entry}
          <PosterCard
            id={entry.anime?.id}
          slug={entry.anime?.slug}
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
      </PosterGrid>
    {:else}
      <div class="empty-state">
        <svg class="empty-state-icon" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M17 2l-5 5-5-5"/></svg>
        <p class="empty-state-text">You're not currently watching any anime</p>
        <p class="empty-state-sub">Start watching something new from your plan to watch list</p>
      </div>
    {/if}
  </section>

  <!-- Currently Reading Section -->
  {#if readingWorks.length > 0}
    <section class="profile-section">
      <div class="section-header">
        <div class="section-header-left">
          <svg width="18" height="18" fill="none" stroke="var(--weeb-purple, var(--weeb-accent))" stroke-width="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <h2 class="section-title">Currently Reading</h2>
          <span class="section-count section-count--accent">{readingTotal}</span>
        </div>
        <a href="/profile/anime?medium=manga" class="section-link">View All</a>
      </div>

      <PosterGrid>
        {#each readingWorks.slice(0, 12) as entry (entry.id)}
          <PosterCard
            id={entry.work?.id ?? ''}
            title={entry.work?.titleEn || entry.work?.titleJp || 'Untitled'}
            image={entry.work?.id ?? ''}
            imagePath="works"
            score={entry.work?.score ?? null}
            sub={workSubtitle(entry.work?.type, entry.work?.publishedFrom)}
            href={entry.work?.urlSlug ? `/manga/${entry.work.urlSlug}` : '/search'}
            onList={entry.status || null}
          />
        {/each}
      </PosterGrid>
    </section>
  {/if}

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
      <PosterGrid>
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
      </PosterGrid>
    {:else if watchlistAnalysis.airingSoon.length > 0}
      <PosterGrid>
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
      </PosterGrid>
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
      <PosterGrid>
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
      </PosterGrid>
    {:else if watchlistAnalysis.recentlyAired.length > 0}
      <PosterGrid>
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
      </PosterGrid>
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
  {queryClient}
  on:close={() => showUploadModal = false}
/>

<ProfileImageUpload
  variant="banner"
  isOpen={showBannerModal}
  {queryClient}
  on:close={() => showBannerModal = false}
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

  /* The uploaded banner covers the gradient when there is one; the gradient
     stays as the ground behind it and the fallback when there is not. */
  .profile-banner-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .profile-banner-edit {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--weeb-fg);
    background: color-mix(in oklch, var(--weeb-bg) 55%, transparent);
    backdrop-filter: blur(8px);
    border: 1px solid var(--weeb-border);
    border-radius: 999px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease, background 0.15s ease;
  }
  .profile-banner:hover .profile-banner-edit,
  .profile-banner-edit:focus-visible {
    opacity: 1;
  }
  .profile-banner-edit:hover:not(:disabled) {
    background: color-mix(in oklch, var(--weeb-bg) 70%, transparent);
  }
  .profile-banner-edit:disabled {
    opacity: 1;
    cursor: default;
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
  .profile-avatar-wrap:hover .profile-avatar-overlay,
  .profile-avatar-overlay:focus-visible { opacity: 1; }

  /* Hover is not available on a touch screen, so on a coarse pointer the only
     way to change an avatar was invisible and undiscoverable. Show it there
     instead, dimmed enough that it reads as a control over the image rather
     than covering it. */
  @media (hover: none) {
    .profile-avatar-overlay {
      opacity: 1;
      background: color-mix(in oklch, black 35%, transparent);
    }
  }

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
    color: var(--weeb-accent-text);
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
    color: var(--weeb-accent-text);
    text-decoration: none; transition: color 0.15s;
  }
  .section-link:hover { color: var(--weeb-accent-hover); }

  /* ── Anime grid ─────────────────────────────────────────────── */
  /* The poster grid lives in PosterGrid.svelte. */

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
  .skeleton-card {
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    overflow: hidden;
  }
  .skeleton-poster {
    aspect-ratio: 2 / 3;
    background: var(--weeb-surface-hover, var(--weeb-surface));
  }
  .skeleton-card-body { padding: 14px; }

  /* ── Responsive: 1024px ────────────────────────────────────── */
  @media (max-width: 1024px) {
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
  }
</style>
