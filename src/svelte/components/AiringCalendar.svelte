<script lang="ts">
  import { onMount } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameDay,
    addMonths,
    subMonths,
    addWeeks,
    subWeeks,
  } from 'date-fns';
  import { fetchCurrentlyAiringWithDates } from '../../services/queries';
  import { parseAirTime } from '../../services/airTimeUtils';
  import { initializeQueryClient } from '../services/query-client';
  import AnimeCalendarPopover from './AnimeCalendarPopover.svelte';
  import Button from './Button.svelte';

  type ViewMode = 'month' | 'week';

  // SSR props
  export let ssrData: any = null;
  export let ssrError: string | null = null;
  export let isTokenExpired: boolean = false;

  let currentDate = new Date();
  let viewMode: ViewMode = 'month';
  let mounted = false;

  // Initialize query client
  const queryClient = initializeQueryClient();

  // Client-side query (will use SSR data as initial data for default month view)
  let currentQuery: any;

  // Calculate date ranges
  $: start = viewMode === 'month'
    ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 })
    : startOfWeek(currentDate, { weekStartsOn: 0 });

  $: end = viewMode === 'month'
    ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 })
    : endOfWeek(currentDate, { weekStartsOn: 0 });

  $: days = eachDayOfInterval({ start, end });

  // Check if current date range matches SSR data range (default month view)
  $: isDefaultMonthView = viewMode === 'month' &&
    isSameDay(currentDate, new Date()) &&
    ssrData;

  // Create query for current date range (only on client)
  $: if (mounted && start && end) {
    const queryConfig = fetchCurrentlyAiringWithDates(start, end);
    currentQuery = createQuery(
      {
        ...queryConfig,
        // Use SSR data as initial data for default month view
        ...(isDefaultMonthView && ssrData && {
          initialData: ssrData
        })
      },
      queryClient
    );
  }

  onMount(() => {
    mounted = true;

    // Handle SSR errors
    if (ssrError) {
      console.warn('SSR Calendar error:', ssrError);
    }

    if (isTokenExpired) {
      console.warn('SSR Calendar: Token was expired during data fetch');
    }

    // Prefetch adjacent date ranges after initial load
    setTimeout(() => {
      if (!queryClient || !mounted) return;

      const ranges = [
        {
          start: viewMode === 'month'
            ? startOfWeek(startOfMonth(subMonths(currentDate, 1)), { weekStartsOn: 0 })
            : startOfWeek(subWeeks(currentDate, 1), { weekStartsOn: 0 }),
          end: viewMode === 'month'
            ? endOfWeek(endOfMonth(subMonths(currentDate, 1)), { weekStartsOn: 0 })
            : endOfWeek(subWeeks(currentDate, 1), { weekStartsOn: 0 }),
        },
        {
          start: viewMode === 'month'
            ? startOfWeek(startOfMonth(addMonths(currentDate, 1)), { weekStartsOn: 0 })
            : startOfWeek(addWeeks(currentDate, 1), { weekStartsOn: 0 }),
          end: viewMode === 'month'
            ? endOfWeek(endOfMonth(addMonths(currentDate, 1)), { weekStartsOn: 0 })
            : endOfWeek(addWeeks(currentDate, 1), { weekStartsOn: 0 }),
        },
      ];

      for (const { start, end } of ranges) {
        queryClient.prefetchQuery(fetchCurrentlyAiringWithDates(start, end));
      }
    }, 1000); // Delay prefetching to avoid interfering with initial load
  });

  // Process anime data by date
  $: animeByDate = (() => {
    const result: Record<string, any[]> = {};

    if (!mounted || !currentQuery || !$currentQuery.data?.currentlyAiring) return result;

    for (const anime of $currentQuery.data.currentlyAiring) {
      for (const episode of anime.episodes || []) {
        // Parse air time for this specific episode
        const episodeAirTime = parseAirTime(episode.airDate, anime.broadcast);
        if (!episodeAirTime) continue;

        const dateKey = format(episodeAirTime, "yyyy-MM-dd");
        if (!result[dateKey]) result[dateKey] = [];

        // Create entry with the episode's specific air time
        const animeEntry = {
          ...anime,
          episodes: [episode], // Pass single episode as array
          episodeAirTime: episodeAirTime, // Use the episode's air time for sorting
        };

        result[dateKey].push(animeEntry);
      }
    }

    // Sort entries by episode air time within each day
    Object.keys(result).forEach(dateKey => {
      result[dateKey].sort((a, b) => {
        const aTime = a.episodeAirTime;
        const bTime = b.episodeAirTime;

        if (aTime && bTime) {
          return aTime.getTime() - bTime.getTime();
        }

        return 0;
      });
    });

    return result;
  })();

  function isTodayVisible(day: Date): boolean {
    return currentDate.getMonth() === new Date().getMonth() && isSameDay(day, new Date());
  }

  function goPrev() {
    currentDate = viewMode === 'month' ? subMonths(currentDate, 1) : subWeeks(currentDate, 1);
  }

  function goNext() {
    currentDate = viewMode === 'month' ? addMonths(currentDate, 1) : addWeeks(currentDate, 1);
  }

  function setViewModeMonth() {
    viewMode = 'month';
  }

  function setViewModeWeek() {
    viewMode = 'week';
  }

</script>

<div class="max-w-screen-xl mx-auto relative py-8 px-0">
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
    <div class="flex gap-2">
      <Button
        label="Month"
        color={viewMode === 'month' ? 'blue' : 'transparent'}
        status="idle"
        onClick={setViewModeMonth}
        className="px-3 py-1 rounded"
      />

      <Button
        label="Week"
        color={viewMode === 'week' ? 'blue' : 'transparent'}
        status="idle"
        onClick={setViewModeWeek}
        className="px-3 py-1 rounded ml-2"
      />
    </div>

    <div class="flex items-center gap-4">
      <button on:click={goPrev} class="text-sm text-blue-600 dark:text-blue-400 hover:underline transition-colors duration-300">
        ← Previous
      </button>
      <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">
        {viewMode === 'month'
          ? format(currentDate, "MMMM yyyy")
          : `Week of ${format(start, "MMM d")}`}
      </h1>
      <button on:click={goNext} class="text-sm text-blue-600 dark:text-blue-400 hover:underline transition-colors duration-300">
        Next →
      </button>
    </div>
  </div>

  {#if !mounted || !currentQuery || (currentQuery && $currentQuery.isLoading)}
    <!-- Calendar Skeleton -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-px bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden text-sm relative z-0 transition-colors duration-300">
      <!-- Day headers skeleton for desktop only -->
      {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
        <div class="hidden lg:block bg-gray-50 dark:bg-gray-700 py-2 px-2 text-center font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 transition-colors duration-300">
          {day}
        </div>
      {/each}

      <!-- Calendar days skeleton (show 35 cells for a typical month view) -->
      {#each Array(35) as _, index}
        <div class="bg-white dark:bg-gray-800 p-2 transition-colors duration-300 min-h-[140px] flex flex-col justify-start border border-gray-100 dark:border-gray-600">
          <div class="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-1">
            <span>{(index % 31) + 1}</span>
          </div>
          <div class="flex flex-col gap-1 pr-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-500 scrollbar-track-transparent">
            <!-- Simulate varying number of anime entries with more realistic distribution -->
            {#if index === 0 || index === 3 || index === 5 || index === 6}
              <div class="text-xs text-blue-700 dark:text-blue-300 text-left hover:bg-blue-100 dark:hover:bg-blue-800/50 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded transition-colors duration-300 w-full flex flex-col animate-pulse">
                <div class="h-[14px] bg-blue-200 dark:bg-blue-700 rounded w-full"></div>
                <div class="h-[10px] bg-gray-400 dark:bg-gray-600 rounded w-12 mt-0.5"></div>
              </div>
            {/if}
            {#if index === 1 || index === 7 || index === 14}
              <div class="text-xs text-blue-700 dark:text-blue-300 text-left hover:bg-blue-100 dark:hover:bg-blue-800/50 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded transition-colors duration-300 w-full flex flex-col animate-pulse">
                <div class="h-[14px] bg-blue-200 dark:bg-blue-700 rounded w-full"></div>
                <div class="h-[10px] bg-gray-400 dark:bg-gray-600 rounded w-14 mt-0.5"></div>
              </div>
              <div class="text-xs text-blue-700 dark:text-blue-300 text-left hover:bg-blue-100 dark:hover:bg-blue-800/50 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded transition-colors duration-300 w-full flex flex-col animate-pulse">
                <div class="h-[14px] bg-blue-200 dark:bg-blue-700 rounded w-full"></div>
                <div class="h-[10px] bg-gray-400 dark:bg-gray-600 rounded w-16 mt-0.5"></div>
              </div>
            {/if}
            {#if index === 2 || index === 8 || index === 9 || index === 10 || index === 15}
              <div class="text-xs text-blue-700 dark:text-blue-300 text-left hover:bg-blue-100 dark:hover:bg-blue-800/50 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded transition-colors duration-300 w-full flex flex-col animate-pulse">
                <div class="h-[14px] bg-blue-200 dark:bg-blue-700 rounded w-full"></div>
                <div class="h-[10px] bg-gray-400 dark:bg-gray-600 rounded w-12 mt-0.5"></div>
              </div>
              <div class="text-xs text-blue-700 dark:text-blue-300 text-left hover:bg-blue-100 dark:hover:bg-blue-800/50 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded transition-colors duration-300 w-full flex flex-col animate-pulse">
                <div class="h-[14px] bg-blue-200 dark:bg-blue-700 rounded w-full"></div>
                <div class="h-[10px] bg-gray-400 dark:bg-gray-600 rounded w-14 mt-0.5"></div>
              </div>
              <div class="text-xs text-blue-700 dark:text-blue-300 text-left hover:bg-blue-100 dark:hover:bg-blue-800/50 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded transition-colors duration-300 w-full flex flex-col animate-pulse">
                <div class="h-[14px] bg-blue-200 dark:bg-blue-700 rounded w-full"></div>
                <div class="h-[10px] bg-gray-400 dark:bg-gray-600 rounded w-10 mt-0.5"></div>
              </div>
            {/if}
            {#if index === 4 || index === 11 || index === 18}
              <div class="text-xs text-blue-700 dark:text-blue-300 text-left hover:bg-blue-100 dark:hover:bg-blue-800/50 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded transition-colors duration-300 w-full flex flex-col animate-pulse">
                <div class="h-[14px] bg-blue-200 dark:bg-blue-700 rounded w-full"></div>
                <div class="h-[10px] bg-gray-400 dark:bg-gray-600 rounded w-14 mt-0.5"></div>
              </div>
              <div class="text-xs text-blue-700 dark:text-blue-300 text-left hover:bg-blue-100 dark:hover:bg-blue-800/50 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded transition-colors duration-300 w-full flex flex-col animate-pulse">
                <div class="h-[14px] bg-blue-200 dark:bg-blue-700 rounded w-full"></div>
                <div class="h-[10px] bg-gray-400 dark:bg-gray-600 rounded w-12 mt-0.5"></div>
              </div>
              <div class="text-xs text-blue-700 dark:text-blue-300 text-left hover:bg-blue-100 dark:hover:bg-blue-800/50 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded transition-colors duration-300 w-full flex flex-col animate-pulse">
                <div class="h-[14px] bg-blue-200 dark:bg-blue-700 rounded w-full"></div>
                <div class="h-[10px] bg-gray-400 dark:bg-gray-600 rounded w-16 mt-0.5"></div>
              </div>
              <div class="text-xs text-blue-700 dark:text-blue-300 text-left hover:bg-blue-100 dark:hover:bg-blue-800/50 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded transition-colors duration-300 w-full flex flex-col animate-pulse">
                <div class="h-[14px] bg-blue-200 dark:bg-blue-700 rounded w-full"></div>
                <div class="h-[10px] bg-gray-400 dark:bg-gray-600 rounded w-14 mt-0.5"></div>
              </div>
            {/if}
            {#if index === 12 || index === 19 || index === 20}
              <div class="text-xs text-blue-700 dark:text-blue-300 text-left hover:bg-blue-100 dark:hover:bg-blue-800/50 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded transition-colors duration-300 w-full flex flex-col animate-pulse">
                <div class="h-[14px] bg-blue-200 dark:bg-blue-700 rounded w-full"></div>
                <div class="h-[10px] bg-gray-400 dark:bg-gray-600 rounded w-12 mt-0.5"></div>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-px bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden text-sm relative z-0 transition-colors duration-300">
      <!-- Day headers for desktop only -->
      {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
        <div class="hidden lg:block bg-gray-50 dark:bg-gray-700 py-2 px-2 text-center font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 transition-colors duration-300">
          {day}
        </div>
      {/each}

      <!-- Calendar days -->
      {#each days as day (format(day, 'yyyy-MM-dd'))}
        {@const dateKey = format(day, 'yyyy-MM-dd')}
        {@const entries = animeByDate[dateKey] || []}
        {@const isToday = isTodayVisible(day)}

        <div class="bg-white dark:bg-gray-800 p-2 transition-colors duration-300 {viewMode === 'month' ? 'min-h-[140px]' : ''} flex flex-col justify-start border border-gray-100 dark:border-gray-600 {isToday ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-400 dark:ring-blue-500' : ''}">
          <div class="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-1">
            <span>{format(day, 'd')}</span>
            <span class="text-gray-500 dark:text-gray-400 text-xs block lg:hidden">
              ({format(day, 'EEE')})
            </span>
          </div>
          <div class="flex flex-col gap-1 pr-1 {viewMode === 'month' ? 'overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-500 scrollbar-track-transparent' : ''}">
            {#each entries as anime, index (`${anime.id}-${index}`)}
              <AnimeCalendarPopover {anime} />
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>