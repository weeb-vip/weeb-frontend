<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { onMount } from 'svelte';
  import AnimeCard from './AnimeCard.svelte';
  import AnimeCardSkeleton from './AnimeCardSkeleton.svelte';
  import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
  import Button from './Button.svelte';
  import { initializeQueryClient } from '../services/query-client';
  import { fetchSeasonalAnime } from '../../services/queries';
  import { useAddAnimeWithToast, useDeleteAnimeWithToast } from '../utils/anime-actions';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';
  import { fade, fly } from 'svelte/transition';
  import '@fortawesome/fontawesome-free/css/all.min.css';

  export let seasonalData: any;
  export let season: string;
  export let ssrError: string | null = null;
  export let isTokenExpired: boolean = false;

  let animeStatuses: Record<string, 'idle' | 'loading' | 'success' | 'error'> = {};

  const queryClient = initializeQueryClient();

  // Season navigation helpers
  const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

  function parseSeason(s: string): { name: string; year: number } {
    const [name, yearStr] = s.split('_');
    return { name, year: parseInt(yearStr) };
  }

  function getAdjacentSeason(s: string, direction: -1 | 1): string {
    const { name, year } = parseSeason(s);
    let idx = seasons.indexOf(name) + direction;
    let y = year;
    if (idx < 0) { idx = seasons.length - 1; y--; }
    if (idx >= seasons.length) { idx = 0; y++; }
    return `${seasons[idx]}_${y}`;
  }

  function getSeasonDisplayName(s: string): string {
    const { name, year } = parseSeason(s);
    return `${name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()} ${year}`;
  }

  function getCurrentSeason(): string {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    if (month >= 3 && month <= 5) return `SPRING_${year}`;
    if (month >= 6 && month <= 8) return `SUMMER_${year}`;
    if (month >= 9 && month <= 11) return `FALL_${year}`;
    const winterYear = month === 11 ? year + 1 : year;
    return `WINTER_${winterYear}`;
  }

  $: prevSeason = getAdjacentSeason(season, -1);
  $: nextSeason = getAdjacentSeason(season, 1);
  const currentSeason = getCurrentSeason();

  // Seed SSR data into query cache so it survives client-side refetch failures
  $: if (seasonalData) {
    const { queryKey } = fetchSeasonalAnime(season, 500);
    queryClient.setQueryData(queryKey, seasonalData);
  }

  // Query for seasonal anime - reactive to season prop changes (View Transitions)
  $: seasonalAnimeQuery = createQuery({
    ...fetchSeasonalAnime(season, 500),
    refetchOnWindowFocus: false,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  }, queryClient);

  // Prefetch adjacent seasons
  $: {
    queryClient.prefetchQuery({
      ...fetchSeasonalAnime(prevSeason, 500),
      staleTime: 10 * 60 * 1000,
    });
    queryClient.prefetchQuery({
      ...fetchSeasonalAnime(nextSeason, 500),
      staleTime: 10 * 60 * 1000,
    });
  }

  const upsertAnimeMutation = useAddAnimeWithToast();
  const deleteAnimeMutation = useDeleteAnimeWithToast();

  function handleAddAnime(id: string, animeId: string) {
    animeStatuses[id] = 'loading';
    $upsertAnimeMutation.mutate({ input: { animeID: animeId, status: 'PLANTOWATCH' } });
  }

  function handleStatusChange(event: CustomEvent) {
    const { animeId, status } = event.detail;
    $upsertAnimeMutation.mutate({ input: { animeID: animeId, status } });
  }

  function handleDelete(event: CustomEvent) {
    const { animeId } = event.detail;
    $deleteAnimeMutation.mutate(animeId);
  }

  // Sort anime by rating descending
  function sortByRating(animeList: any[]) {
    return [...animeList].sort((a, b) => {
      const getRating = (rating: any) => {
        if (!rating || rating === 'N/A') return 0;
        const parsed = parseFloat(rating);
        return isNaN(parsed) ? 0 : parsed;
      };
      return getRating(b.rating) - getRating(a.rating);
    });
  }

  $: animeList = $seasonalAnimeQuery.data?.animeBySeasons
    ? sortByRating($seasonalAnimeQuery.data.animeBySeasons)
    : seasonalData?.animeBySeasons
      ? sortByRating(seasonalData.animeBySeasons)
      : [];
</script>

<div class="flex flex-col max-w-screen-2xl px-4 lg:px-0" style="margin: 0 auto">
  <!-- Header with season nav -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-6 mb-6 gap-4">
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
      {getSeasonDisplayName(season)} Anime
    </h1>

    <div class="flex items-center gap-2">
      <a
        href="/season/{prevSeason}"
        class="px-3 py-1.5 rounded text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
      >
        <i class="fas fa-chevron-left mr-1"></i>
        {getSeasonDisplayName(prevSeason)}
      </a>

      {#if season !== currentSeason}
        <a
          href="/season/{currentSeason}"
          class="px-3 py-1.5 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200"
        >
          Current
        </a>
      {/if}

      <a
        href="/season/{nextSeason}"
        class="px-3 py-1.5 rounded text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
      >
        {getSeasonDisplayName(nextSeason)}
        <i class="fas fa-chevron-right ml-1"></i>
      </a>
    </div>
  </div>

  <!-- Anime count -->
  {#if animeList.length > 0}
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
      {animeList.length} anime
    </p>
  {/if}

  <!-- Content -->
  <div class="relative overflow-hidden">
    <div class="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center min-h-[400px]">
      {#if $seasonalAnimeQuery.isLoading && !seasonalData}
        {#each Array(16) as _, index}
          <div in:fade={{ duration: 150 }}>
            <AnimeCardSkeleton style="detail" />
          </div>
        {/each}
      {:else if ssrError && animeList.length === 0}
        <div class="col-span-full text-center py-12">
          <p class="text-gray-500 dark:text-gray-400 text-lg">{ssrError}</p>
        </div>
      {:else if animeList.length === 0}
        <div class="col-span-full text-center py-12">
          <p class="text-gray-500 dark:text-gray-400 text-lg">No anime found for this season.</p>
        </div>
      {:else}
        {#each animeList as anime, index (anime.id)}
          <div in:fly={{ y: 15, duration: 200, delay: Math.min(index * 20, 400) }}>
            <AnimeCard
              style="detail"
              id={anime.id}
              title={getAnimeTitle(anime, $preferencesStore.titleLanguage)}
              description={anime.description || ''}
              tags={anime.tags || []}
              episodes={Math.max(anime.episodeCount || 0, anime.episodes?.length || 0)}
              episodeLength={anime.duration ? anime.duration.replace(/per.+?$|per/gm, '') : "?"}
              year={getYearUTC(anime.startDate)}
              image={GetImageFromAnime(anime)}
              entry={anime.userAnime}
            >
              <div slot="options">
                {#if !anime.userAnime}
                  <Button
                    color="blue"
                    label="Add to list"
                    showLabel={true}
                    status={animeStatuses[`season-${anime.id}`] || 'idle'}
                    className="w-fit px-2 py-1 text-xs"
                    onClick={() => handleAddAnime(`season-${anime.id}`, anime.id)}
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
