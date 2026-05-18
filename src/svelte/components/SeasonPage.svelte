<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { onMount } from 'svelte';
  import PosterCard from './PosterCard.svelte';
  import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
  import Button from './Button.svelte';
  import { initializeQueryClient } from '../services/query-client';
  import { fetchSeasonalAnime } from '../../services/queries';
  import { useAddAnimeWithToast, useDeleteAnimeWithToast } from '../utils/anime-actions';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';
  import SafeImage from './SafeImage.svelte';
  import { fade, fly } from 'svelte/transition';
  import '@fortawesome/fontawesome-free/css/all.min.css';

  export let seasonalData: any;
  export let season: string;
  export let ssrError: string | null = null;
  export let isTokenExpired: boolean = false;

  // Make season a local reactive variable so we can switch without page navigation
  let activeSeason = season;

  function navigateToSeason(newSeason: string) {
    activeSeason = newSeason;
    // Update URL without page reload
    history.pushState({ season: newSeason }, '', `/season/${newSeason}`);
    // Reset filters
    selectedTags = new Set();
    showAllTags = false;
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Handle browser back/forward
  onMount(() => {
    function handlePopState(e: PopStateEvent) {
      if (e.state?.season) {
        activeSeason = e.state.season;
        selectedTags = new Set();
        showAllTags = false;
      }
    }
    window.addEventListener('popstate', handlePopState);
    // Set initial state
    history.replaceState({ season: activeSeason }, '', `/season/${activeSeason}`);
    return () => window.removeEventListener('popstate', handlePopState);
  });

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

  $: prevSeason = getAdjacentSeason(activeSeason, -1);
  $: nextSeason = getAdjacentSeason(activeSeason, 1);
  const currentSeason = getCurrentSeason();

  // Seed SSR data into query cache so it survives client-side refetch failures
  $: if (seasonalData) {
    const { queryKey } = fetchSeasonalAnime(season, 500);
    queryClient.setQueryData(queryKey, seasonalData);
  }

  // Query for seasonal anime - reactive to activeSeason changes (client-side navigation)
  $: seasonalAnimeQuery = createQuery({
    ...fetchSeasonalAnime(activeSeason, 500),
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
    : (activeSeason === season && seasonalData?.animeBySeasons)
      ? sortByRating(seasonalData.animeBySeasons)
      : [];

  // Tag filter
  let selectedTags: Set<string> = new Set();
  let showAllTags = false;

  $: allTags = (() => {
    const tagCount: Record<string, number> = {};
    for (const anime of animeList) {
      if (anime.tags) {
        for (const tag of anime.tags) {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        }
      }
    }
    return Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  })();

  $: visibleTags = showAllTags ? allTags : allTags.slice(0, 12);

  function toggleTag(tag: string) {
    if (selectedTags.has(tag)) {
      selectedTags.delete(tag);
    } else {
      selectedTags.add(tag);
    }
    selectedTags = selectedTags; // trigger reactivity
  }

  function clearTags() {
    selectedTags = new Set();
  }

  $: filteredAnimeList = selectedTags.size === 0
    ? animeList
    : animeList.filter(anime =>
        anime.tags && [...selectedTags].every(t => anime.tags.includes(t))
      );
</script>

<div class="season-page">

  <!-- Page Header -->
  <header class="page-header">
    <p class="page-eyebrow">Seasonal Anime</p>
    <h1 class="page-title">
      <span class="accent">{parseSeason(activeSeason).name.charAt(0).toUpperCase() + parseSeason(activeSeason).name.slice(1).toLowerCase()}</span> {parseSeason(activeSeason).year}
    </h1>
  </header>

  <!-- Season / Year Selector -->
  <div class="season-selector">
    <div class="season-tabs" role="tablist">
      {#each seasons as s}
        {@const sKey = `${s}_${parseSeason(activeSeason).year}`}
        <button
          type="button"
          class="season-tab"
          class:active={parseSeason(activeSeason).name === s}
          on:click={() => navigateToSeason(sKey)}
        >
          <span class="season-tab-icon">
            {#if s === 'WINTER'}&#10052;{:else if s === 'SPRING'}&#9880;{:else if s === 'SUMMER'}&#9728;{:else}&#127810;{/if}
          </span>
          {s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()}
        </button>
      {/each}
    </div>

    <div class="season-nav">
      <button type="button" class="season-arrow" aria-label="Previous season" on:click={() => navigateToSeason(prevSeason)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>

      <div class="year-selector">
        {#each [parseSeason(activeSeason).year - 1, parseSeason(activeSeason).year, parseSeason(activeSeason).year + 1] as yr}
          {@const yrKey = `${parseSeason(activeSeason).name}_${yr}`}
          <button
            type="button"
            class="year-tab"
            class:active={parseSeason(activeSeason).year === yr}
            on:click={() => navigateToSeason(yrKey)}
          >
            {yr}
          </button>
        {/each}
      </div>

      <button type="button" class="season-arrow" aria-label="Next season" on:click={() => navigateToSeason(nextSeason)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
  </div>

  <!-- Stats Bar -->
  <div class="season-stats">
    <span class="stats-label">
      {#if $seasonalAnimeQuery.isFetching && animeList.length === 0}
        Loading...
      {:else if animeList.length > 0}
        Showing {filteredAnimeList.length}{selectedTags.size > 0 ? ` / ${animeList.length}` : ''} titles
      {:else}
        No titles
      {/if}
    </span>

    {#if activeSeason !== currentSeason}
      <span class="stats-divider"></span>
      <button type="button" class="current-season-link" on:click={() => navigateToSeason(currentSeason)}>
        Jump to current season
      </button>
    {/if}
  </div>

  <!-- Top This Season — compact strip -->
  {#if animeList.length >= 3}
    <div class="top-strip">
      <span class="top-strip-label">TOP THIS SEASON</span>
      <div class="top-strip-items">
        {#each animeList.slice(0, 5) as anime, i}
          <a href="/show/{anime.id}" class="top-strip-card">
            <span class="top-strip-rank">#{i + 1}</span>
            <div class="top-strip-poster">
              <SafeImage
                src={GetImageFromAnime(anime)}
                alt={getAnimeTitle(anime, $preferencesStore.titleLanguage)}
                className="w-full h-full object-cover"
              />
            </div>
            <div class="top-strip-info">
              <span class="top-strip-title">{getAnimeTitle(anime, $preferencesStore.titleLanguage)}</span>
              <span class="top-strip-meta">
                {#if anime.rating && anime.rating !== 'N/A'}★ {anime.rating}{/if}
                {#if anime.studios?.[0]} · {anime.studios[0]}{/if}
              </span>
            </div>
          </a>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Filter & Grid Header -->
  <div class="filter-bar">
    <h2 class="filter-title">All Shows</h2>
    <div class="filter-pills">
      <span class="filter-count">{filteredAnimeList.length}{selectedTags.size > 0 ? ` / ${animeList.length}` : ''} titles</span>
    </div>
  </div>

  <!-- Tag Filter -->
  {#if allTags.length > 0}
    <div class="tag-filter">
      <div class="tag-filter-row">
        {#if selectedTags.size > 0}
          <button class="tag-pill tag-pill--clear" on:click={clearTags}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            Clear
          </button>
        {/if}
        {#each visibleTags as { tag, count }}
          <button
            class="tag-pill"
            class:active={selectedTags.has(tag)}
            on:click={() => toggleTag(tag)}
          >
            {tag}
            <span class="tag-count">{count}</span>
          </button>
        {/each}
        {#if allTags.length > 12}
          <button class="tag-pill tag-pill--toggle" on:click={() => showAllTags = !showAllTags}>
            {showAllTags ? 'Show less' : `+${allTags.length - 12} more`}
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Poster Grid -->
  <div class="shows-grid" class:loading={$seasonalAnimeQuery.isFetching && animeList.length > 0}>
    {#if $seasonalAnimeQuery.isLoading && !seasonalData}
      {#each Array(16) as _}
        <div class="skeleton-card">
          <div class="skeleton-poster"></div>
          <div class="skeleton-title"></div>
          <div class="skeleton-sub"></div>
        </div>
      {/each}
    {:else if ssrError && filteredAnimeList.length === 0}
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
        </div>
        <p class="empty-state-title">Something went wrong</p>
        <p class="empty-state-desc">{ssrError}</p>
      </div>
    {:else if filteredAnimeList.length === 0}
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/><path d="M9 10h.01M15 10h.01M9.5 15.5a3.5 3.5 0 0 1 5 0"/></svg>
        </div>
        <p class="empty-state-title">No anime found</p>
        <p class="empty-state-desc">
          {#if selectedTags.size > 0}
            No anime match the selected tags. <button class="empty-clear-btn" on:click={clearTags}>Clear filters</button>
          {:else}
            There are no anime listed for {getSeasonDisplayName(activeSeason)} yet.
          {/if}
        </p>
      </div>
    {:else}
      {#each filteredAnimeList as anime, index (anime.id)}
        <div in:fly={{ y: 15, duration: 200, delay: Math.min(index * 20, 400) }}>
          <PosterCard
            id={anime.id}
            title={getAnimeTitle(anime, $preferencesStore.titleLanguage)}
            image={GetImageFromAnime(anime)}
            score={anime.rating && anime.rating !== 'N/A' ? parseFloat(anime.rating) : null}
            status={anime.status || null}
            sub={anime.studios?.[0] || `${getYearUTC(anime.startDate)} · ${anime.episodeCount || '?'} ep`}
            genres={anime.tags || []}
            description={anime.description || ''}
            episodeCount={anime.episodeCount}
            onList={anime.userAnime?.status || null}
          />
        </div>
      {/each}
    {/if}
  </div>

</div>

<style>
  /* ── Page layout ── */
  .season-page {
    width: 100%;
    padding: 48px var(--weeb-section-px, 48px) 0;
  }

  /* ── Page header ── */
  .page-header {
    margin-bottom: 32px;
  }

  .page-eyebrow {
    font-family: var(--weeb-font-mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--weeb-accent);
    margin-bottom: 8px;
  }

  .page-title {
    font-size: clamp(28px, 4vw, 42px);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
    color: var(--weeb-fg);
  }

  .page-title .accent {
    color: var(--weeb-accent);
  }

  /* ── Season selector ── */
  .season-selector {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 32px;
    flex-wrap: wrap;
  }

  .season-tabs {
    display: flex;
    gap: 2px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: 10px;
    padding: 4px;
  }

  .season-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    text-decoration: none;
    transition: all 0.18s;
    white-space: nowrap;
  }

  .season-tab:hover:not(.active) {
    color: var(--weeb-fg);
    background: var(--weeb-surface-hover);
  }

  .season-tab.active {
    background: var(--weeb-accent);
    color: white;
    font-weight: 600;
  }

  .season-tab-icon {
    font-size: 14px;
  }

  /* ── Year nav ── */
  .season-nav {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
  }

  .season-arrow {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid var(--weeb-border);
    background: var(--weeb-surface);
    color: var(--weeb-fg-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    text-decoration: none;
  }

  .season-arrow:hover {
    border-color: var(--weeb-accent);
    color: var(--weeb-accent);
    background: var(--weeb-bg-elevated);
  }

  .year-selector {
    display: flex;
    gap: 4px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: 10px;
    padding: 4px;
  }

  .year-tab {
    padding: 6px 14px;
    border-radius: 7px;
    font-family: var(--weeb-font-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--weeb-fg-muted);
    text-decoration: none;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .year-tab:hover:not(.active) {
    color: var(--weeb-fg);
    background: var(--weeb-surface-hover);
  }

  .year-tab.active {
    background: var(--weeb-accent);
    color: white;
  }

  /* ── Stats bar ── */
  .season-stats {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 14px 20px;
    background: var(--weeb-bg-elevated);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg);
    margin-bottom: 40px;
    flex-wrap: wrap;
  }

  .stats-label {
    font-family: var(--weeb-font-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--weeb-accent);
  }

  .stats-divider {
    width: 1px;
    height: 16px;
    background: var(--weeb-border);
  }

  .current-season-link {
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--weeb-fg-muted);
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.15s;
  }

  .current-season-link:hover {
    color: var(--weeb-accent);
  }

  /* ── Featured section ── */
  .section-heading {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 20px;
  }

  .section-title {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--weeb-fg);
  }

  /* ── Top strip ── */
  .top-strip {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    background: var(--weeb-bg-elevated);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    margin-bottom: 32px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .top-strip::-webkit-scrollbar { display: none; }

  .top-strip-label {
    font-family: var(--weeb-font-mono);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--weeb-accent);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .top-strip-items {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .top-strip-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 14px 6px 8px;
    border-radius: var(--weeb-radius, 8px);
    text-decoration: none;
    color: inherit;
    transition: background 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .top-strip-card:hover {
    background: var(--weeb-surface-hover);
  }

  .top-strip-rank {
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    font-weight: 800;
    color: var(--weeb-accent);
    width: 22px;
    text-align: center;
    flex-shrink: 0;
  }

  .top-strip-poster {
    width: 32px;
    height: 44px;
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--weeb-surface);
  }

  .top-strip-poster :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .top-strip-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .top-strip-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--weeb-fg);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .top-strip-meta {
    font-family: var(--weeb-font-mono);
    font-size: 11px;
    color: var(--weeb-fg-muted);
  }

  /* ── Filter bar ── */
  .filter-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    gap: 12px;
    flex-wrap: wrap;
    border-top: 1px solid var(--weeb-border);
    padding-top: 32px;
  }

  .filter-title {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--weeb-fg);
  }

  .filter-count {
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--weeb-fg-muted);
    padding: 6px 14px;
    border-radius: var(--weeb-radius, 8px);
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
  }

  /* ── Tag filter ── */
  .tag-filter {
    margin-bottom: 24px;
  }
  .tag-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .tag-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: var(--weeb-radius-full, 20px);
    border: 1px solid var(--weeb-border);
    background: transparent;
    color: var(--weeb-fg-secondary);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  .tag-pill:hover {
    border-color: var(--weeb-accent);
    color: var(--weeb-fg);
    background: var(--weeb-surface);
  }
  .tag-pill.active {
    background: var(--weeb-accent);
    border-color: var(--weeb-accent);
    color: white;
  }
  .tag-pill.active .tag-count {
    background: oklch(100% 0 0 / 0.2);
    color: white;
  }
  .tag-count {
    font-family: var(--weeb-font-mono);
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 10px;
    background: var(--weeb-surface);
    color: var(--weeb-fg-muted);
  }
  .tag-pill--clear {
    border-color: var(--weeb-red);
    color: var(--weeb-red);
    gap: 4px;
  }
  .tag-pill--clear:hover {
    background: var(--weeb-red);
    border-color: var(--weeb-red);
    color: white;
  }
  .tag-pill--toggle {
    border-style: dashed;
    color: var(--weeb-fg-muted);
  }
  .tag-pill--toggle:hover {
    border-style: solid;
    border-color: var(--weeb-accent);
    color: var(--weeb-accent);
  }
  .empty-clear-btn {
    background: none;
    border: none;
    color: var(--weeb-accent);
    cursor: pointer;
    font-size: inherit;
    text-decoration: underline;
    padding: 0;
  }

  /* ── Gradient placeholders ── */
  .grad-1 { background: linear-gradient(145deg, oklch(35% 0.18 280), oklch(20% 0.12 260), oklch(15% 0.08 300)); }
  .grad-2 { background: linear-gradient(145deg, oklch(30% 0.15 300), oklch(18% 0.10 275), oklch(22% 0.14 250)); }
  .grad-3 { background: linear-gradient(145deg, oklch(32% 0.12 250), oklch(22% 0.16 280), oklch(18% 0.10 310)); }
  .grad-4 { background: linear-gradient(145deg, oklch(28% 0.14 155), oklch(18% 0.08 180), oklch(22% 0.12 140)); }
  .grad-5 { background: linear-gradient(145deg, oklch(30% 0.16 25), oklch(20% 0.10 350), oklch(18% 0.12 40)); }
  .grad-6 { background: linear-gradient(145deg, oklch(25% 0.10 85), oklch(18% 0.14 60), oklch(22% 0.08 100)); }
  .grad-7 { background: linear-gradient(145deg, oklch(33% 0.13 270), oklch(20% 0.09 290), oklch(25% 0.15 255)); }
  .grad-8 { background: linear-gradient(145deg, oklch(22% 0.15 310), oklch(28% 0.10 280), oklch(18% 0.08 330)); }

  /* ── Poster grid ── */
  .shows-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 16px;
    min-height: 400px;
    transition: opacity 0.2s ease;
  }
  .shows-grid.loading {
    opacity: 0.4;
    pointer-events: none;
  }
  .shows-grid > :global(*) {
    max-width: 200px;
  }

  /* ── Skeleton cards ── */
  .skeleton-card {
    display: flex;
    flex-direction: column;
  }
  .skeleton-poster {
    aspect-ratio: 2/3;
    border-radius: var(--weeb-radius, 8px);
    background: var(--weeb-surface);
    animation: shimmer 1.5s infinite;
  }
  .skeleton-title {
    height: 14px;
    border-radius: 4px;
    background: var(--weeb-surface);
    margin-top: 8px;
    width: 85%;
    animation: shimmer 1.5s infinite;
  }
  .skeleton-sub {
    height: 12px;
    border-radius: 4px;
    background: var(--weeb-surface);
    margin-top: 4px;
    width: 55%;
    animation: shimmer 1.5s infinite;
  }
  @keyframes shimmer {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.8; }
  }

  /* ── Empty state ── */
  .empty-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 24px;
    text-align: center;
  }

  .empty-state-icon {
    color: var(--weeb-fg-muted);
    margin-bottom: 20px;
    opacity: 0.5;
  }

  .empty-state-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--weeb-fg-secondary);
    margin-bottom: 8px;
  }

  .empty-state-desc {
    font-size: 14px;
    color: var(--weeb-fg-muted);
    max-width: 320px;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .season-page {
      padding: 24px 16px 0;
    }

    .page-title {
      font-size: 24px;
    }

    .shows-grid {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 12px;
    }

    .season-selector {
      gap: 8px;
    }

    .season-nav {
      margin-left: 0;
      width: 100%;
      justify-content: space-between;
    }

    .season-stats {
      gap: 12px;
    }

    .stats-divider {
      display: none;
    }

    .filter-bar {
      padding-top: 24px;
    }

    .filter-title {
      font-size: 18px;
    }

    .top-strip {
      padding: 10px 12px;
      gap: 12px;
      border-radius: var(--weeb-radius, 8px);
      margin-bottom: 24px;
    }

    .top-strip-title {
      max-width: 140px;
    }
  }

  @media (max-width: 480px) {
    .shows-grid {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 10px;
    }

    .season-tabs {
      overflow-x: auto;
    }

    .year-selector {
      overflow-x: auto;
    }
  }
</style>
