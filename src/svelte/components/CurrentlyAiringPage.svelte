<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { format } from 'date-fns';
  import { utc } from '@date-fns/utc/utc';
  import SafeImage from './SafeImage.svelte';
  import { initializeQueryClient } from '../services/query-client';
  import { fetchCurrentlyAiringWithDatesAndEpisodes } from '../../services/queries';
  import { useAddAnimeWithToast, useDeleteAnimeWithToast } from '../utils/anime-actions';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';
  import { findNextEpisode, getAirTimeDisplay } from '../../services/airTimeUtils';
  import { animeNotificationService } from '../../services/animeNotifications';
  import { navigateWithTransition } from '../../utils/astro-navigation';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';
  import { getCurrentSeason, getSeasonDisplayName } from '../../utils/seasonUtils';

  // SSR props
  export let ssrData: any = null;
  export let ssrError: string | null = null;
  export let isTokenExpired: boolean = false;

  let animeStatuses: Record<string, 'idle' | 'loading' | 'success' | 'error'> = {};

  // Initialize query client
  const queryClient = initializeQueryClient();

  // Fetch from start of current month to end of next month — shared by schedule + calendar
  const now = new Date();
  const initialStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const initialEndDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  // Track the query date range so we can expand it when calendar navigates
  let queryStartDate = initialStartDate;
  let queryEndDate = initialEndDate;

  // Create TanStack Query stores with SSR data
  const currentlyAiringQuery = createQuery({
    ...fetchCurrentlyAiringWithDatesAndEpisodes(queryStartDate, queryEndDate, undefined, 100),
    initialData: ssrData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 2 * 60 * 1000,
  }, queryClient);

  // Track loading state for calendar month navigation
  let calendarLoading = false;

  // Store additional anime data fetched for other months (merged with main query data)
  let additionalAnimeData: any[] = [];

  // Fetch additional data when calendar navigates outside current range
  async function fetchMonthData(year: number, month: number) {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    // Check if the requested month is already within our query range
    if (monthStart >= queryStartDate && monthEnd <= queryEndDate) return;

    // Expand the range to include the new month
    if (monthStart < queryStartDate) queryStartDate = monthStart;
    if (monthEnd > queryEndDate) queryEndDate = monthEnd;

    calendarLoading = true;
    try {
      const newQueryOpts = fetchCurrentlyAiringWithDatesAndEpisodes(queryStartDate, queryEndDate, undefined, 200);
      const result = await queryClient.fetchQuery(newQueryOpts);
      // Merge the new data into our additional store
      if (result?.currentlyAiring) {
        additionalAnimeData = result.currentlyAiring;
      }
    } catch (err) {
      console.error('Failed to fetch calendar data:', err);
    } finally {
      calendarLoading = false;
    }
  }

  // Create enhanced mutations with toast handling
  const upsertAnimeMutation = useAddAnimeWithToast();

  // Extend with custom status tracking callbacks
  const originalUpsertMutate = upsertAnimeMutation.mutate;
  upsertAnimeMutation.mutate = (variables, options = {}) => {
    // Update status tracking on success
    const originalOnSuccess = options.onSuccess;
    options.onSuccess = (data, vars) => {
      // Update anime status
      animeStatuses = { ...animeStatuses };
      const animeId = vars.animeID;
      Object.keys(animeStatuses).forEach(key => {
        if (key.includes(animeId)) {
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

  const deleteAnimeMutation = useDeleteAnimeWithToast();

  // Process currently airing data for airing page with categories
  function processCurrentlyAiring(data: any) {
    if (!data?.currentlyAiring) return [];

    const now = new Date();
    const currentlyAiringShows = data.currentlyAiring || [];
    const processedAnime: any[] = [];
    const seenKeys = new Set<string>();

    // Process each anime — expand ALL episodes into separate entries for schedule + calendar
    currentlyAiringShows.forEach((anime: any) => {
      if (!anime) return;

      // Collect all episodes to process (both nextEpisode and episodes array)
      const allEpisodes: any[] = [];
      if (anime.episodes && anime.episodes.length > 0) {
        allEpisodes.push(...anime.episodes);
      } else if (anime.nextEpisode) {
        allEpisodes.push(anime.nextEpisode);
      }

      allEpisodes.forEach((episode: any) => {
        if (!episode || (!episode.airDate && !episode.airTime)) return;

        const episodeAirTime = episode.airTime ? new Date(episode.airTime) : new Date(episode.airDate);

        // Deduplicate: same anime + same episode number
        const dedupeKey = `${anime.id}-ep${episode.episodeNumber}`;
        if (seenKeys.has(dedupeKey)) return;
        seenKeys.add(dedupeKey);

        const airTimeInfo = getAirTimeDisplay(episode.airDate, anime.broadcast) || {
          show: true,
          text: episodeAirTime <= now
            ? "Recently aired"
            : `${format(episodeAirTime, "EEE")} at ${format(episodeAirTime, "h:mm a")}`,
          variant: episodeAirTime <= now ? 'aired' as const : 'scheduled' as const
        };

        processedAnime.push({
          id: `airing-${anime.id}-ep${episode.episodeNumber}`,
          anime: {
            id: anime.id,
            titleEn: anime.titleEn,
            titleJp: anime.titleJp,
            description: anime.description,
            tags: anime.tags || [],
            episodeCount: anime.episodes?.length || null,
            duration: anime.duration,
            startDate: anime.startDate,
            imageUrl: anime.imageUrl,
            userAnime: anime.userAnime || null
          },
          status: null,
          airingInfo: {
            ...anime,
            airTimeDisplay: airTimeInfo,
            nextEpisodeDate: episodeAirTime,
            nextEpisode: {
              ...episode,
              airDate: episodeAirTime
            },
            isInWatchlist: false
          }
        });
      });
    });

    // Sort all entries by air date
    return processedAnime
            .sort((a, b) => a.airingInfo.nextEpisodeDate.getTime() - b.airingInfo.nextEpisodeDate.getTime());
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

  // Reactive data using TanStack Query stores — merge main query data with additional calendar data
  $: sortedCurrentlyAiring = (() => {
    const mainData = $currentlyAiringQuery.data;
    if (!mainData && additionalAnimeData.length === 0) return [];

    // Merge: start with main query data, then add any additional anime from calendar fetches
    const mergedData = { currentlyAiring: [...(mainData?.currentlyAiring || [])] };

    if (additionalAnimeData.length > 0) {
      const existingIds = new Set(mergedData.currentlyAiring.map((a: any) => a?.id));
      additionalAnimeData.forEach((anime: any) => {
        if (anime && !existingIds.has(anime.id)) {
          mergedData.currentlyAiring.push(anime);
        }
      });
    }

    return processCurrentlyAiring(mergedData);
  })();

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

  // Group by day of week for schedule view (matches HTML prototype)
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  $: dayGroups = (() => {
    if (!sortedCurrentlyAiring.length) return [];

    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Group ALL entries by their air date
    const dateMap = new Map<string, typeof sortedCurrentlyAiring>();

    sortedCurrentlyAiring.forEach(entry => {
      const airTime = entry.airingInfo.nextEpisodeDate;
      const airIso = `${airTime.getFullYear()}-${String(airTime.getMonth() + 1).padStart(2, '0')}-${String(airTime.getDate()).padStart(2, '0')}`;

      if (!dateMap.has(airIso)) {
        dateMap.set(airIso, []);
      }
      dateMap.get(airIso)!.push(entry);
    });

    // Sort dates and build groups
    const sortedDates = [...dateMap.keys()].sort();

    return sortedDates.map(iso => {
      const d = new Date(iso + 'T12:00:00');
      const dow = d.getDay();
      const dateStr = format(d, 'MMM d');
      const isToday = iso === todayIso;
      const entries = dateMap.get(iso)!;

      return {
        id: iso,
        dayName: DAY_NAMES[dow],
        date: dateStr,
        isToday,
        entries
      };
    });
  })();

  // Schedule view: filter dayGroups to only show today onwards
  $: allScheduleDayGroups = (() => {
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return dayGroups.filter(g => g.id >= todayIso);
  })();

  // Show first 7 days by default, expand with "Load more"
  let scheduleVisibleDays = 7;
  $: scheduleDayGroups = allScheduleDayGroups.slice(0, scheduleVisibleDays);
  $: hasMoreScheduleDays = allScheduleDayGroups.length > scheduleVisibleDays;
  $: remainingScheduleDays = allScheduleDayGroups.length - scheduleVisibleDays;
  function loadMoreSchedule() { scheduleVisibleDays += 7; }

  // Season display
  $: currentSeasonLabel = getSeasonDisplayName(getCurrentSeason());

  // View toggle: schedule vs calendar
  let activeView: 'schedule' | 'calendar' = 'schedule';

  // Timezone
  const TIMEZONES = [
    { value: 'local', label: Intl.DateTimeFormat().resolvedOptions().timeZone },
    { value: 'JST', label: 'JST (UTC+9)' },
    { value: 'EST', label: 'EST (UTC-5)' },
    { value: 'GMT', label: 'GMT (UTC+0)' },
    { value: 'PST', label: 'PST (UTC-8)' },
    { value: 'CET', label: 'CET (UTC+1)' },
  ];
  let selectedTimezone = 'local';

  // My list only toggle
  let myListOnly = false;

  // Calendar state
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  let selectedCalDate: string | null = null;

  $: calMonthLabel = new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function prevMonth() {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    selectedCalDate = null;
    fetchMonthData(calYear, calMonth);
  }
  function nextMonth() {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    selectedCalDate = null;
    fetchMonthData(calYear, calMonth);
  }

  // Build calendar grid
  $: calendarDays = (() => {
    const firstDay = new Date(calYear, calMonth, 1);
    let startDow = firstDay.getDay();
    startDow = (startDow + 6) % 7; // Monday = 0
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();
    const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const days: { num: number; iso: string; otherMonth: boolean; isToday: boolean; showCount: number }[] = [];
    for (let i = 0; i < totalCells; i++) {
      let dayNum: number, iso: string, otherMonth = false;
      if (i < startDow) {
        dayNum = daysInPrevMonth - startDow + 1 + i;
        const pm = calMonth === 0 ? 11 : calMonth - 1;
        const py = calMonth === 0 ? calYear - 1 : calYear;
        iso = `${py}-${String(pm + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        otherMonth = true;
      } else if (i >= startDow + daysInMonth) {
        dayNum = i - startDow - daysInMonth + 1;
        const nm = calMonth === 11 ? 0 : calMonth + 1;
        const ny = calMonth === 11 ? calYear + 1 : calYear;
        iso = `${ny}-${String(nm + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        otherMonth = true;
      } else {
        dayNum = i - startDow + 1;
        iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      }
      // Count shows airing on this day (filtered by myListOnly)
      const showCount = sortedCurrentlyAiring.filter(entry => {
        if (myListOnly && entry.airingInfo.userAnime == null) return false;
        const airDate = entry.airingInfo.nextEpisodeDate;
        const airIso = `${airDate.getFullYear()}-${String(airDate.getMonth() + 1).padStart(2, '0')}-${String(airDate.getDate()).padStart(2, '0')}`;
        return airIso === iso;
      }).length;
      days.push({ num: dayNum, iso, otherMonth, isToday: iso === todayIso, showCount });
    }
    return days;
  })();

  // Get shows for selected calendar date (filtered by myListOnly)
  $: selectedDayShows = selectedCalDate ? sortedCurrentlyAiring.filter(entry => {
    if (myListOnly && entry.airingInfo.userAnime == null) return false;
    const airDate = entry.airingInfo.nextEpisodeDate;
    const airIso = `${airDate.getFullYear()}-${String(airDate.getMonth() + 1).padStart(2, '0')}-${String(airDate.getDate()).padStart(2, '0')}`;
    return airIso === selectedCalDate;
  }) : [];

  $: selectedDayLabel = selectedCalDate
    ? new Date(selectedCalDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '--';

  // Collapsible sections
  let collapsedDays: Record<string, boolean> = {};
  function toggleDay(dayId: string) {
    collapsedDays = { ...collapsedDays, [dayId]: !collapsedDays[dayId] };
  }

  // Countdown text for each entry
  function getCountdownText(entry: any): { text: string; status: 'aired' | 'airing-now' | 'upcoming' } {
    const now = new Date();
    const airTime = entry.airingInfo.nextEpisodeDate;
    const diffMs = airTime.getTime() - now.getTime();

    if (diffMs <= 0 && Math.abs(diffMs) <= 30 * 60 * 1000) {
      return { text: 'LIVE', status: 'airing-now' };
    }
    if (diffMs <= 0) {
      return { text: 'Aired', status: 'aired' };
    }

    const totalMin = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;

    if (hours < 24) {
      return { text: `In ${hours}h ${String(mins).padStart(2, '0')}m`, status: 'upcoming' };
    }

    const days = Math.floor(hours / 24);
    return { text: `In ${days}d ${hours % 24}h`, status: 'upcoming' };
  }
</script>

<div class="airing-page">
  <!-- Page Header -->
  <div class="page-header">
    <div class="page-header-inner">
      <div class="page-header-left">
        <div class="page-header-eyebrow">
          <div class="live-dot"></div>
          <span class="label">{currentSeasonLabel}</span>
        </div>
        <h1 class="page-title">Currently Airing</h1>
      </div>

      <div class="page-header-controls">
        <div class="view-tabs" role="tablist">
          <button class="view-tab" class:active={activeView === 'schedule'} role="tab" aria-selected={activeView === 'schedule'} on:click={() => activeView = 'schedule'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            Schedule
          </button>
          <button class="view-tab" class:active={activeView === 'calendar'} role="tab" aria-selected={activeView === 'calendar'} on:click={() => activeView = 'calendar'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Calendar
          </button>
        </div>

        <select class="tz-select" bind:value={selectedTimezone} aria-label="Timezone">
          {#each TIMEZONES as tz}
            <option value={tz.value}>{tz.label}</option>
          {/each}
        </select>

        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <label class="toggle-wrap" class:on={myListOnly} on:click={() => myListOnly = !myListOnly} role="switch" aria-checked={myListOnly} tabindex="0">
          <span class="toggle-switch"></span>
          My list only
        </label>
      </div>
    </div>
  </div>

  <!-- Schedule View -->
  {#if activeView === 'schedule'}
  <div class="schedule-view">
    {#if $currentlyAiringQuery.isLoading}
      {#each Array(3) as _, i}
        <div class="day-section">
          <div class="day-section-header">
            <span class="day-name skeleton-text" style="width: 120px;"></span>
          </div>
          <div class="day-cards">
            {#each Array(4) as _}
              <div class="show-card skeleton-show-card">
                <div class="show-poster skeleton-poster-sm"></div>
                <div class="show-info">
                  <div class="skeleton-text" style="width: 80%;"></div>
                  <div class="skeleton-text" style="width: 50%; margin-top: 6px;"></div>
                  <div class="skeleton-text" style="width: 60%; margin-top: 8px;"></div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    {:else if scheduleDayGroups.length === 0}
      <div class="empty-state">
        <p>No upcoming airing anime found.</p>
      </div>
    {:else}
      {#each scheduleDayGroups as group (group.id)}
        {@const filteredEntries = myListOnly ? group.entries.filter(e => e.airingInfo.userAnime != null) : group.entries}
        {#if filteredEntries.length > 0}
        <div class="day-section" class:collapsed={collapsedDays[group.id]}>
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <div class="day-section-header" on:click={() => toggleDay(group.id)} role="button" tabindex="0">
            <span class="day-name">{group.dayName}</span>
            {#if group.date}
              <span class="day-date">{group.date}</span>
            {/if}
            {#if group.isToday}
              <span class="day-today-badge">
                <span class="live-dot" style="width:6px;height:6px;"></span>
                Today
              </span>
            {/if}
            <span class="day-count">{filteredEntries.length} show{filteredEntries.length !== 1 ? 's' : ''}</span>
            <svg class="day-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>

          {#if !collapsedDays[group.id]}
            <div class="day-cards">
              {#each filteredEntries as entry (entry.id)}
                {@const countdown = getCountdownText(entry)}
                {@const airTime = entry.airingInfo.nextEpisodeDate}
                {@const title = getAnimeTitle(entry.airingInfo, $preferencesStore.titleLanguage)}
                {@const ep = entry.airingInfo.nextEpisode ? `Ep ${entry.airingInfo.nextEpisode.episodeNumber}` : ''}
                {@const timeStr = format(airTime, 'HH:mm')}
                {@const isInList = entry.airingInfo.userAnime != null}

                <a href="/show/{entry.airingInfo.id}" class="show-card" on:click|preventDefault={() => navigateToShow(entry.airingInfo.id)}>
                  <div class="show-poster">
                    <img
                      src={`https://cdn.weeb.vip/weeb-staging/${encodeURIComponent(GetImageFromAnime(entry.airingInfo))}`}
                      alt={title}
                      loading="lazy"
                      on:error={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                  <div class="show-info">
                    <div class="show-title">{title}</div>
                    <div class="show-meta-row">
                      <span class="show-ep">{ep}</span>
                      <span class="show-time">{timeStr}</span>
                    </div>
                    <span class="show-countdown {countdown.status}">
                      {#if countdown.status === 'airing-now'}
                        <span class="airing-now-dot"></span>
                      {/if}
                      {countdown.text}
                    </span>
                  </div>
                  {#if !isInList}
                    <button class="show-add-btn" title="Add to list" aria-label="Add to list" on:click|preventDefault|stopPropagation={() => handleAddAnime(entry.id, entry.airingInfo.id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  {/if}
                </a>
              {/each}
            </div>
          {/if}
        </div>
        {/if}
      {/each}

      {#if myListOnly && scheduleDayGroups.every(g => g.entries.filter(e => e.airingInfo.userAnime != null).length === 0)}
        <div class="empty-state">
          <p>No anime from your list are airing in this period.</p>
          <button class="empty-state-btn" on:click={() => myListOnly = false}>Show all anime</button>
        </div>
      {/if}
    {/if}

    {#if hasMoreScheduleDays}
      {@const nextBatch = Math.min(7, remainingScheduleDays)}
      <button class="load-more-btn" on:click={loadMoreSchedule}>
        Show next {nextBatch} day{nextBatch === 1 ? '' : 's'}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
    {/if}
  </div>
  {/if}

  <!-- Calendar View -->
  {#if activeView === 'calendar'}
  <div class="calendar-view">
    <div class="calendar-layout">
      <div class="calendar-card" class:loading={calendarLoading}>
        <div class="calendar-nav">
          <button class="cal-nav-btn" on:click={prevMonth} aria-label="Previous month" disabled={calendarLoading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span class="calendar-month-label">
            {calMonthLabel}
            {#if calendarLoading}
              <span class="cal-loading-dot"></span>
            {/if}
          </span>
          <button class="cal-nav-btn" on:click={nextMonth} aria-label="Next month" disabled={calendarLoading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
        <div class="calendar-weekdays">
          <div class="cal-weekday">Mon</div>
          <div class="cal-weekday">Tue</div>
          <div class="cal-weekday">Wed</div>
          <div class="cal-weekday">Thu</div>
          <div class="cal-weekday">Fri</div>
          <div class="cal-weekday">Sat</div>
          <div class="cal-weekday">Sun</div>
        </div>
        <div class="calendar-days">
          {#each calendarDays as day}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div
              class="cal-day"
              class:other-month={day.otherMonth}
              class:today={day.isToday}
              class:selected={selectedCalDate === day.iso}
              on:click={() => selectedCalDate = day.iso}
              role="button"
              tabindex="0"
            >
              <div class="cal-day-num">{day.num}</div>
              {#if day.showCount > 0}
                <div class="cal-dots">
                  {#each Array(Math.min(day.showCount, 5)) as _, i}
                    <div class="cal-dot" class:cal-dot-accent={i % 4 === 0} class:cal-dot-violet={i % 4 === 1} class:cal-dot-green={i % 4 === 2} class:cal-dot-amber={i % 4 === 3}></div>
                  {/each}
                </div>
                <span class="cal-show-count">{day.showCount}</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="cal-side-panel">
        <div class="cal-panel-header">
          <span class="cal-panel-label">Selected Day</span>
          <span class="cal-panel-date">{selectedDayLabel}</span>
        </div>
        {#if !selectedCalDate}
          <div class="cal-panel-empty">Select a day to see airing shows</div>
        {:else if selectedDayShows.length === 0}
          <div class="cal-panel-empty">{myListOnly ? 'No shows from your list airing this day' : 'No shows airing this day'}</div>
        {:else}
          <div class="cal-panel-shows">
            {#each selectedDayShows as entry}
              {@const title = getAnimeTitle(entry.airingInfo, $preferencesStore.titleLanguage)}
              {@const ep = entry.airingInfo.nextEpisode ? `Ep ${entry.airingInfo.nextEpisode.episodeNumber}` : ''}
              {@const timeStr = format(entry.airingInfo.nextEpisodeDate, 'HH:mm')}
              <a href="/show/{entry.airingInfo.id}" class="cal-show-item" on:click|preventDefault={() => navigateToShow(entry.airingInfo.id)}>
                <div class="cal-show-poster">
                  <img
                    src={`https://cdn.weeb.vip/weeb-staging/${encodeURIComponent(GetImageFromAnime(entry.airingInfo))}`}
                    alt={title}
                    loading="lazy"
                    on:error={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
                <div class="cal-show-info">
                  <div class="cal-show-title">{title}</div>
                  <div class="cal-show-meta">
                    <span class="cal-ep">{ep}</span>
                    <span class="cal-time">{timeStr}</span>
                  </div>
                </div>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
  {/if}
</div>

<style>
  /* ---- Layout ---- */
  .airing-page {
    max-width: 100%;
    margin: 0 auto;
    padding: 0 var(--weeb-section-px, 48px);
  }

  /* ---- Page Header ---- */
  .page-header {
    padding: 40px 0 24px;
    border-bottom: 1px solid var(--weeb-border);
  }
  .page-header-inner {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
  }
  .page-header-left {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .page-header-eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--weeb-green);
    box-shadow: 0 0 0 0 oklch(65% 0.15 155 / 0.4);
    animation: pulse-dot 2s infinite;
  }
  @keyframes pulse-dot {
    0%   { box-shadow: 0 0 0 0 oklch(65% 0.15 155 / 0.4); }
    70%  { box-shadow: 0 0 0 8px oklch(65% 0.15 155 / 0); }
    100% { box-shadow: 0 0 0 0 oklch(65% 0.15 155 / 0); }
  }
  .label {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 600;
    font-family: var(--weeb-font-mono);
    color: var(--weeb-accent);
  }
  .page-title {
    font-size: clamp(1.75rem, 3vw, 2.5rem);
    line-height: 1.1;
    letter-spacing: -0.025em;
    font-weight: 700;
    color: var(--weeb-fg);
    margin: 0;
  }
  .page-header-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  /* ---- View Tabs ---- */
  .view-tabs {
    display: flex;
    align-items: center;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    padding: 3px;
    gap: 2px;
  }
  .view-tab {
    height: 30px;
    padding: 0 14px;
    border-radius: calc(var(--weeb-radius) - 2px);
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-muted);
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
  }
  .view-tab:hover { color: var(--weeb-fg-secondary); }
  .view-tab.active { background: var(--weeb-accent); color: white; }

  /* ---- Timezone Select ---- */
  .tz-select {
    height: 34px;
    padding: 0 30px 0 10px;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    background: var(--weeb-surface);
    color: var(--weeb-fg-secondary);
    font-size: 13px;
    font-family: var(--weeb-font-mono);
    font-variant-numeric: tabular-nums;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .tz-select:focus { outline: none; border-color: var(--weeb-accent); }

  /* ---- My List Toggle ---- */
  .toggle-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--weeb-fg-muted);
    cursor: pointer;
    user-select: none;
    padding: 4px 0;
  }
  .toggle-wrap:hover { color: var(--weeb-fg-secondary); }
  .toggle-switch {
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    position: relative;
    transition: background 0.2s, border-color 0.2s;
    flex-shrink: 0;
  }
  .toggle-switch::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--weeb-fg-muted);
    top: 1px;
    left: 1px;
    transition: transform 0.2s, background 0.2s;
  }
  .toggle-wrap.on .toggle-switch { background: var(--weeb-accent); border-color: var(--weeb-accent); }
  .toggle-wrap.on .toggle-switch::after { transform: translateX(16px); background: white; }

  /* ---- Schedule View ---- */
  .schedule-view { padding: 32px 0 64px; }

  /* ---- Day Section ---- */
  .day-section { margin-bottom: 32px; }
  .day-section:last-child { margin-bottom: 0; }

  .day-section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--weeb-border);
    cursor: pointer;
    user-select: none;
  }
  .day-section-header:hover .day-name { color: var(--weeb-accent-hover, var(--weeb-accent)); }
  .day-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--weeb-fg);
    transition: color 0.15s;
  }
  .day-date {
    font-size: 13px;
    color: var(--weeb-fg-muted);
    font-family: var(--weeb-font-mono);
    font-variant-numeric: tabular-nums;
  }
  .day-today-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 8px;
    border-radius: 11px;
    background: var(--weeb-green);
    color: oklch(18% 0.02 155);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
  .day-count {
    font-size: 12px;
    color: var(--weeb-fg-muted);
    margin-left: auto;
  }
  .day-chevron {
    color: var(--weeb-fg-muted);
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  .collapsed .day-chevron { transform: rotate(-90deg); }

  /* ---- Horizontal Show Cards ---- */
  .day-cards {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 4px;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
  }
  .day-cards::-webkit-scrollbar { height: 4px; }
  .day-cards::-webkit-scrollbar-track { background: transparent; }
  .day-cards::-webkit-scrollbar-thumb { background: var(--weeb-border); border-radius: 2px; }

  .show-card {
    flex-shrink: 0;
    width: 320px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    transition: background 0.15s, border-color 0.15s, transform 0.15s;
    scroll-snap-align: start;
    text-decoration: none;
    color: inherit;
  }
  .show-card:hover {
    background: var(--weeb-surface-hover);
    border-color: oklch(34% 0.02 275);
    transform: translateY(-1px);
  }

  .show-poster {
    width: 50px;
    height: 70px;
    border-radius: var(--weeb-radius);
    flex-shrink: 0;
    overflow: hidden;
    background: var(--weeb-bg-elevated);
  }
  .show-poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .show-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .show-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--weeb-fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }
  .show-meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .show-ep {
    font-size: 12px;
    color: var(--weeb-fg-muted);
  }
  .show-time {
    font-family: var(--weeb-font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 12px;
    color: var(--weeb-fg-muted);
  }

  /* ---- Countdown Badges ---- */
  .show-countdown {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 8px;
    border-radius: 11px;
    font-size: 11px;
    font-weight: 600;
    font-family: var(--weeb-font-mono);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    margin-top: 4px;
    width: fit-content;
  }
  .show-countdown.upcoming {
    background: oklch(55% 0.15 280 / 0.15);
    color: var(--weeb-accent-hover, var(--weeb-accent));
  }
  .show-countdown.aired {
    background: oklch(28% 0.015 275 / 0.6);
    color: var(--weeb-fg-muted);
  }
  .show-countdown.airing-now {
    background: oklch(65% 0.15 155 / 0.15);
    color: var(--weeb-green);
  }
  .airing-now-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--weeb-green);
    animation: pulse-dot 2s infinite;
  }

  /* ---- Add Button ---- */
  .show-add-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--weeb-fg-muted);
    background: var(--weeb-bg);
    border: 1px solid var(--weeb-border);
    transition: all 0.15s;
    opacity: 0;
    cursor: pointer;
    padding: 0;
  }
  .show-card:hover .show-add-btn { opacity: 1; }
  .show-add-btn:hover {
    color: var(--weeb-accent);
    border-color: var(--weeb-accent);
    background: oklch(55% 0.15 280 / 0.1);
  }

  /* ---- Show card position for add btn ---- */
  .show-card { position: relative; }

  /* ---- Load More Button ---- */
  .load-more-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    max-width: 400px;
    margin: 32px auto 0;
    padding: 14px 24px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    color: var(--weeb-fg-secondary);
    font-family: var(--weeb-font);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .load-more-btn:hover {
    background: var(--weeb-surface-hover);
    border-color: var(--weeb-accent);
    color: var(--weeb-fg);
  }
  .load-more-btn svg {
    transition: transform 0.2s;
  }
  .load-more-btn:hover svg {
    transform: translateY(2px);
  }

  /* ============================================
     CALENDAR VIEW
     ============================================ */
  .calendar-view { padding: 32px 0 64px; }
  .calendar-layout {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 24px;
    align-items: start;
  }
  .calendar-card {
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    overflow: hidden;
    transition: opacity 0.2s;
  }
  .calendar-card.loading .calendar-days {
    opacity: 0.4;
    pointer-events: none;
  }
  .cal-loading-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--weeb-accent);
    margin-left: 8px;
    animation: pulse-dot 1s infinite;
    vertical-align: middle;
  }
  .cal-nav-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .calendar-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--weeb-border);
  }
  .cal-nav-btn {
    width: 32px;
    height: 32px;
    border-radius: var(--weeb-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--weeb-fg-muted);
    transition: all 0.15s;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
  }
  .cal-nav-btn:hover { background: var(--weeb-surface-hover); color: var(--weeb-fg); }
  .calendar-month-label {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--weeb-fg);
  }
  .calendar-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border-bottom: 1px solid var(--weeb-border);
  }
  .cal-weekday {
    padding: 8px 0;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted);
  }
  .calendar-days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
  }
  .cal-day {
    min-height: 80px;
    padding: 8px;
    border-right: 1px solid var(--weeb-border);
    border-bottom: 1px solid var(--weeb-border);
    cursor: pointer;
    transition: background 0.15s;
    position: relative;
  }
  .cal-day:nth-child(7n) { border-right: none; }
  .cal-day:hover { background: var(--weeb-surface-hover); }
  .cal-day.other-month { opacity: 0.3; }
  .cal-day.today .cal-day-num {
    background: var(--weeb-accent);
    color: white;
    border-radius: 50%;
    font-weight: 700;
    font-size: 13px;
  }
  .cal-day.selected { background: oklch(55% 0.15 280 / 0.15); }
  .cal-day.selected .cal-day-num {
    border: 2px solid var(--weeb-accent);
    border-radius: 50%;
    color: var(--weeb-accent);
    font-weight: 700;
  }
  .cal-day.today.selected .cal-day-num {
    background: var(--weeb-accent);
    color: white;
    border: none;
  }
  .cal-day-num {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 4px;
    color: var(--weeb-fg);
  }
  .cal-dots {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }
  .cal-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
  .cal-dot-accent { background: var(--weeb-accent); }
  .cal-dot-violet { background: var(--weeb-violet, oklch(62% 0.14 300)); }
  .cal-dot-green  { background: var(--weeb-green); }
  .cal-dot-amber  { background: var(--weeb-amber); }
  .cal-show-count {
    position: absolute;
    bottom: 4px;
    right: 6px;
    font-size: 10px;
    font-family: var(--weeb-font-mono);
    font-variant-numeric: tabular-nums;
    color: var(--weeb-fg-muted);
  }

  /* ---- Calendar Side Panel ---- */
  .cal-side-panel {
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    overflow: hidden;
    position: sticky;
    top: 72px;
  }
  .cal-panel-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--weeb-border);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cal-panel-label {
    font-size: 11px;
    color: var(--weeb-fg-muted);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 600;
  }
  .cal-panel-date {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--weeb-fg);
  }
  .cal-panel-empty {
    padding: 40px 20px;
    text-align: center;
    color: var(--weeb-fg-muted);
    font-size: 14px;
  }
  .cal-panel-shows { display: flex; flex-direction: column; }
  .cal-show-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    border-bottom: 1px solid var(--weeb-border);
    transition: background 0.1s;
    text-decoration: none;
    color: inherit;
  }
  .cal-show-item:last-child { border-bottom: none; }
  .cal-show-item:hover { background: var(--weeb-surface-hover); }
  .cal-show-poster {
    width: 36px;
    height: 50px;
    border-radius: calc(var(--weeb-radius) - 2px);
    flex-shrink: 0;
    overflow: hidden;
    background: var(--weeb-bg-elevated);
  }
  .cal-show-poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .cal-show-info { flex: 1; min-width: 0; }
  .cal-show-title {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
    color: var(--weeb-fg);
  }
  .cal-show-meta { display: flex; align-items: center; gap: 8px; }
  .cal-ep { font-size: 11px; color: var(--weeb-fg-muted); }
  .cal-time {
    font-family: var(--weeb-font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    color: var(--weeb-fg-muted);
  }

  /* ---- Empty & Skeleton ---- */
  .empty-state {
    padding: 80px 20px;
    text-align: center;
    color: var(--weeb-fg-muted);
    font-size: 15px;
  }
  .empty-state-btn {
    margin-top: 12px;
    background: none;
    border: 1px solid var(--weeb-border);
    color: var(--weeb-accent);
    padding: 8px 20px;
    border-radius: var(--weeb-radius, 8px);
    cursor: pointer;
    font-size: 13px;
    transition: border-color 0.15s;
  }
  .empty-state-btn:hover {
    border-color: var(--weeb-accent);
  }
  .skeleton-text {
    height: 14px;
    border-radius: 4px;
    background: var(--weeb-surface);
    animation: shimmer 1.5s infinite;
    display: block;
  }
  .skeleton-show-card {
    opacity: 0.6;
  }
  .skeleton-poster-sm {
    width: 50px;
    height: 70px;
    border-radius: var(--weeb-radius);
    background: var(--weeb-surface-hover);
    animation: shimmer 1.5s infinite;
    flex-shrink: 0;
  }
  @keyframes shimmer {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.8; }
  }

  /* ---- Responsive ---- */
  @media (max-width: 1024px) {
    .show-card { width: 290px; }
  }
  @media (max-width: 768px) {
    .show-card { width: 260px; }
    .page-header { padding: 24px 0 16px; }
    .page-title { font-size: 1.5rem; }
    .page-header-controls { width: 100%; }
  }
  @media (max-width: 900px) {
    .calendar-layout { grid-template-columns: 1fr; }
  }
  @media (max-width: 480px) {
    .airing-page { padding: 0 16px; }
    .show-card { width: 85vw; }
    .page-header-controls {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    .cal-day { min-height: 52px; padding: 4px; }
    .cal-day-num { width: 22px; height: 22px; font-size: 11px; }
    .cal-show-count { display: none; }
  }
</style>
