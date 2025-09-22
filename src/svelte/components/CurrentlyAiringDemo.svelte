<script lang="ts">
  import { createQuery, createMutation } from '@tanstack/svelte-query';
  import { format } from 'date-fns';
  import { utc } from '@date-fns/utc/utc';
  import AnimeCard from './AnimeCard.svelte';
  import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
  import Button from './Button.svelte';
  import HeroBanner from './HeroBanner.svelte';
  import HeroBannerSkeleton from './HeroBannerSkeleton.svelte';
  import { initializeQueryClient } from '../services/query-client';
  import {
    fetchCurrentlyAiring,
    upsertAnime,
    deleteAnime
  } from '../../services/queries';
  import { GetImageFromAnime } from '../../services/utils';
  import { findNextEpisode, getAirTimeDisplay } from '../../services/airTimeUtils';
  import { animeNotificationService } from '../../services/animeNotifications';
  import { navigateWithTransition } from '../../utils/astro-navigation';

  let animeStatuses: Record<string, 'idle' | 'loading' | 'success' | 'error'> = {};

  // Initialize query client
  const queryClient = initializeQueryClient();

  // Create TanStack Query stores
  const currentlyAiringQuery = createQuery(fetchCurrentlyAiring(), queryClient);

  // Create mutations with success callbacks
  const upsertAnimeMutation = createMutation({
    ...upsertAnime(),
    onSuccess: (data, variables) => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['currently-airing'] });

      // Update anime status
      animeStatuses = { ...animeStatuses };
      const animeId = variables.input.animeID;
      Object.keys(animeStatuses).forEach(key => {
        if (key.includes(animeId)) {
          animeStatuses[key] = 'success';
        }
      });
    },
    onError: (error, variables) => {
      console.error('❌ Upsert mutation failed:', error);

      // Update anime status to error
      const animeId = variables.input.animeID;
      animeStatuses = { ...animeStatuses };
      Object.keys(animeStatuses).forEach(key => {
        if (key.includes(animeId)) {
          animeStatuses[key] = 'error';
        }
      });
    }
  }, queryClient);

  const deleteAnimeMutation = createMutation({
    ...deleteAnime(),
    onSuccess: (data, animeId) => {
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['currently-airing'] });
    },
    onError: (error) => {
      console.error('❌ Delete mutation failed:', error);
    }
  }, queryClient);

  // Process currently airing data for airing page with categories
  function processCurrentlyAiring(data: any) {
    if (!data?.currentlyAiring) return [];

    const now = new Date();
    const currentlyAiringShows = data.currentlyAiring || [];
    const processedAnime: any[] = [];

    // Process each anime and determine its next episode
    currentlyAiringShows.forEach((anime: any) => {
      if (!anime || !(anime as any).episodes || (anime as any).episodes.length === 0) return;

      const episodes = (anime as any).episodes;

      // Skip anime where all episodes have null airdate
      const hasValidAirDate = episodes.some((ep: any) => ep.airDate !== null && ep.airDate !== undefined);
      if (!hasValidAirDate) return;

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
                  : (() => {
                      const timeDiff = nextEpisodeAirTime.getTime() - now.getTime();
                      const isWithin24Hours = timeDiff <= (24 * 60 * 60 * 1000);
                      return isWithin24Hours
                        ? `Airing ${format(nextEpisodeAirTime, "EEE")} at ${format(nextEpisodeAirTime, "h:mm a")}`
                        : `${format(nextEpisodeAirTime, "EEE")} at ${format(nextEpisodeAirTime, "h:mm a")}`;
                    })(),
          variant: nextEpisodeAirTime <= now ? 'aired' as const : 'scheduled' as const
        };

        const processedEntry = {
          id: `airing-${anime.id}`,
          anime: {
            id: anime.id,
            titleEn: anime.titleEn,
            titleJp: anime.titleJp,
            description: anime.description,
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
            .slice(0, 10); // More entries for airing page

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

  function navigateToShow(animeId: string) {
    // Use proper navigation for View Transitions
    navigateWithTransition(`/show/${animeId}`);
  }

  function navigateToCalendar() {
    // Use proper navigation for View Transitions
    navigateWithTransition('/airing/calendar');
  }

  // Reactive data using TanStack Query stores
  $: sortedCurrentlyAiring = processCurrentlyAiring($currentlyAiringQuery.data);

  // Debug logging for data fetching
  $: {
    console.log('Currently airing query status:', {
      isLoading: $currentlyAiringQuery.isLoading,
      isError: $currentlyAiringQuery.isError,
      isSuccess: $currentlyAiringQuery.isSuccess,
      error: $currentlyAiringQuery.error,
      dataKeys: $currentlyAiringQuery.data ? Object.keys($currentlyAiringQuery.data) : null,
      currentlyAiringCount: $currentlyAiringQuery.data?.currentlyAiring?.length || 0
    });
  }

  // Set up anime notifications when currently airing data is available
  $: if ($currentlyAiringQuery.isSuccess && $currentlyAiringQuery.data?.currentlyAiring) {
    // Notifications are now managed globally by AnimeNotificationProvider
    // Just trigger an update to refresh the data for the hero banner
    setTimeout(() => {
      animeNotificationService.triggerImmediateUpdate();
    }, 50);
  }

  // Determine which anime to show in banner (first airing anime, no hover handling)
  $: bannerAnime = sortedCurrentlyAiring[0]?.airingInfo;

  // Categorize anime for different sections
  $: categorizedAnime = (() => {
    if (!sortedCurrentlyAiring.length) return {
      airingToday: [],
      airingThisWeek: [],
      comingSoon: [],
      recentlyAired: []
    };

    const now = new Date();
    const categories = {
      airingToday: [] as typeof sortedCurrentlyAiring,
      airingThisWeek: [] as typeof sortedCurrentlyAiring,
      comingSoon: [] as typeof sortedCurrentlyAiring,
      recentlyAired: [] as typeof sortedCurrentlyAiring
    };

    sortedCurrentlyAiring.forEach(entry => {
      const airTime = entry.airingInfo.nextEpisodeDate;
      const diffMs = airTime.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffMs <= 0 && Math.abs(diffMs) <= (7 * 24 * 60 * 60 * 1000)) {
        categories.recentlyAired.push(entry);
      } else if (diffMs > 0 && diffMs <= (24 * 60 * 60 * 1000)) {
        categories.airingToday.push(entry);
      } else if (diffDays > 0 && diffDays <= 7) {
        categories.airingThisWeek.push(entry);
      } else {
        categories.comingSoon.push(entry);
      }
    });

    return categories;
  })();
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

  <!-- Header with Calendar Button -->
  <div class="mb-8 flex justify-end">
    <a
      href="/airing/calendar"
      class="inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
    >
      View Calendar
    </a>
  </div>

  <!-- Content Sections -->
  <div class="space-y-8">
    <!-- Airing Next 24 Hours -->
    {#if categorizedAnime.airingToday.length > 0}
      <div class="flex flex-col space-y-4">
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
          Airing Next 24 Hours ({categorizedAnime.airingToday.length})
        </h2>
        <div class="flex flex-col space-y-4">
          {#each categorizedAnime.airingToday as entry (entry.id)}
            <AnimeCard
              forceListLayout={true}
              id={entry.airingInfo.id}
              style="episode"
              title={entry.airingInfo.titleEn || entry.airingInfo.titleJp || "Unknown"}
              episodeTitle={entry.airingInfo.nextEpisode?.titleEn || entry.airingInfo.nextEpisode?.titleJp || "Unknown"}
              description=""
              episodeLength=""
              episodeNumber={entry.airingInfo.nextEpisode?.episodeNumber?.toString() || "Unknown"}
              className="hover:cursor-pointer"
              year=""
              image={GetImageFromAnime(entry.airingInfo)}
              airdate={entry.airingInfo.nextEpisodeDate ? format(entry.airingInfo.nextEpisodeDate, "EEE MMM do", { in: utc }) : "Unknown"}
              airTime={entry.airingInfo.airTimeDisplay}
              onClick={() => navigateToShow(entry.airingInfo.id)}
              episodes={0}
            >
              <div slot="options">
                {#if !entry.airingInfo.userAnime}
                  <Button
                    color="blue"
                    label="Add to list"
                    status={animeStatuses[entry.airingInfo.id] || 'idle'}
                    onClick={() => handleAddAnime(entry.airingInfo.id, entry.airingInfo.id)}
                  />
                {:else}
                  <AnimeStatusDropdown
                    entry={{
                      ...entry.airingInfo.userAnime,
                      anime: entry.airingInfo
                    }}
                    variant="compact"
                    on:statusChange={handleStatusChange}
                    on:delete={handleDelete}
                  />
                {/if}
              </div>
            </AnimeCard>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Airing This Week -->
    {#if categorizedAnime.airingThisWeek.length > 0}
      <div class="flex flex-col space-y-4">
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
          Airing This Week ({categorizedAnime.airingThisWeek.length})
        </h2>
        <div class="flex flex-col space-y-4">
          {#each categorizedAnime.airingThisWeek as entry (entry.id)}
            <AnimeCard
              forceListLayout={true}
              id={entry.airingInfo.id}
              style="episode"
              title={entry.airingInfo.titleEn || entry.airingInfo.titleJp || "Unknown"}
              episodeTitle={entry.airingInfo.nextEpisode?.titleEn || entry.airingInfo.nextEpisode?.titleJp || "Unknown"}
              description=""
              episodeLength=""
              episodeNumber={entry.airingInfo.nextEpisode?.episodeNumber?.toString() || "Unknown"}
              className="hover:cursor-pointer"
              year=""
              image={GetImageFromAnime(entry.airingInfo)}
              airdate={entry.airingInfo.nextEpisodeDate ? format(entry.airingInfo.nextEpisodeDate, "EEE MMM do", { in: utc }) : "Unknown"}
              airTime={entry.airingInfo.airTimeDisplay}
              onClick={() => navigateToShow(entry.airingInfo.id)}
              episodes={0}
            >
              <div slot="options">
                {#if !entry.airingInfo.userAnime}
                  <Button
                    color="blue"
                    label="Add to list"
                    status={animeStatuses[entry.airingInfo.id] || 'idle'}
                    onClick={() => handleAddAnime(entry.airingInfo.id, entry.airingInfo.id)}
                  />
                {:else}
                  <AnimeStatusDropdown
                    entry={{
                      ...entry.airingInfo.userAnime,
                      anime: entry.airingInfo
                    }}
                    variant="compact"
                    on:statusChange={handleStatusChange}
                    on:delete={handleDelete}
                  />
                {/if}
              </div>
            </AnimeCard>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Recently Aired -->
    {#if categorizedAnime.recentlyAired.length > 0}
      <div class="flex flex-col space-y-4">
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
          Recently Aired ({categorizedAnime.recentlyAired.length})
        </h2>
        <div class="flex flex-col space-y-4">
          {#each categorizedAnime.recentlyAired as entry (entry.id)}
            <AnimeCard
              forceListLayout={true}
              id={entry.airingInfo.id}
              style="episode"
              title={entry.airingInfo.titleEn || entry.airingInfo.titleJp || "Unknown"}
              episodeTitle={entry.airingInfo.nextEpisode?.titleEn || entry.airingInfo.nextEpisode?.titleJp || "Unknown"}
              description=""
              episodeLength=""
              episodeNumber={entry.airingInfo.nextEpisode?.episodeNumber?.toString() || "Unknown"}
              className="hover:cursor-pointer"
              year=""
              image={GetImageFromAnime(entry.airingInfo)}
              airdate={entry.airingInfo.nextEpisodeDate ? format(entry.airingInfo.nextEpisodeDate, "EEE MMM do", { in: utc }) : "Unknown"}
              airTime={entry.airingInfo.airTimeDisplay}
              onClick={() => navigateToShow(entry.airingInfo.id)}
              episodes={0}
            >
              <div slot="options">
                {#if !entry.airingInfo.userAnime}
                  <Button
                    color="blue"
                    label="Add to list"
                    status={animeStatuses[entry.airingInfo.id] || 'idle'}
                    onClick={() => handleAddAnime(entry.airingInfo.id, entry.airingInfo.id)}
                  />
                {:else}
                  <AnimeStatusDropdown
                    entry={{
                      ...entry.airingInfo.userAnime,
                      anime: entry.airingInfo
                    }}
                    variant="compact"
                    on:statusChange={handleStatusChange}
                    on:delete={handleDelete}
                  />
                {/if}
              </div>
            </AnimeCard>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Coming Soon -->
    {#if categorizedAnime.comingSoon.length > 0}
      <div class="flex flex-col space-y-4">
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
          Coming Soon ({categorizedAnime.comingSoon.length})
        </h2>
        <div class="flex flex-col space-y-4">
          {#each categorizedAnime.comingSoon as entry (entry.id)}
            <AnimeCard
              forceListLayout={true}
              id={entry.airingInfo.id}
              style="episode"
              title={entry.airingInfo.titleEn || entry.airingInfo.titleJp || "Unknown"}
              episodeTitle={entry.airingInfo.nextEpisode?.titleEn || entry.airingInfo.nextEpisode?.titleJp || "Unknown"}
              description=""
              episodeLength=""
              episodeNumber={entry.airingInfo.nextEpisode?.episodeNumber?.toString() || "Unknown"}
              className="hover:cursor-pointer"
              year=""
              image={GetImageFromAnime(entry.airingInfo)}
              airdate={entry.airingInfo.nextEpisodeDate ? format(entry.airingInfo.nextEpisodeDate, "EEE MMM do", { in: utc }) : "Unknown"}
              airTime={entry.airingInfo.airTimeDisplay}
              onClick={() => navigateToShow(entry.airingInfo.id)}
              episodes={0}
            >
              <div slot="options">
                {#if !entry.airingInfo.userAnime}
                  <Button
                    color="blue"
                    label="Add to list"
                    status={animeStatuses[entry.airingInfo.id] || 'idle'}
                    onClick={() => handleAddAnime(entry.airingInfo.id, entry.airingInfo.id)}
                  />
                {:else}
                  <AnimeStatusDropdown
                    entry={{
                      ...entry.airingInfo.userAnime,
                      anime: entry.airingInfo
                    }}
                    variant="compact"
                    on:statusChange={handleStatusChange}
                    on:delete={handleDelete}
                  />
                {/if}
              </div>
            </AnimeCard>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
