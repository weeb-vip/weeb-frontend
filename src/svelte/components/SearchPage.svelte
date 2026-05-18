<script lang="ts">
  import { onMount } from 'svelte';
  import { configStore } from '../stores/config';
  import PosterCard from './PosterCard.svelte';
  import SafeImage from './SafeImage.svelte';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';
  import { navigateWithTransition } from '../../utils/astro-navigation';

  let searchQuery = '';
  let results: any[] = [];
  let isLoading = false;
  let hasSearched = false;
  let totalResults = 0;

  // Filters
  let selectedGenres: string[] = [];
  let selectedStatus = '';
  let selectedYear = '';
  let sortBy = 'relevance';
  let viewMode: 'grid' | 'list' = 'grid';
  let showAllGenres = false;

  // Algolia
  let algoliasearch: any = null;
  let searchClient: any = null;
  let algoliaIndex: string = 'anime-staging';

  const GENRES = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
    'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life',
    'Sports', 'Supernatural', 'Thriller', 'Music', 'Mecha'
  ];

  const STATUSES = [
    { value: '', label: 'All' },
    { value: 'CURRENTLY_AIRING', label: 'Airing' },
    { value: 'FINISHED_AIRING', label: 'Finished' },
    { value: 'NOT_YET_AIRED', label: 'Upcoming' },
  ];

  const SORT_OPTIONS = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'score', label: 'Score' },
    { value: 'newest', label: 'Newest' },
    { value: 'title', label: 'A-Z' },
  ];

  onMount(async () => {
    try {
      await configStore.init();
    } catch (e) {
      console.error('Config init failed:', e);
    }

    try {
      const algoliasearchModule = await import('algoliasearch/lite');
      if (typeof algoliasearchModule.default === 'function') {
        algoliasearch = algoliasearchModule.default;
      } else if (algoliasearchModule.liteClient) {
        algoliasearch = algoliasearchModule.liteClient;
      }

      const config = configStore.get();
      algoliaIndex = config?.algolia_index || 'anime-staging';
      searchClient = algoliasearch("A2HF2P5C6X", "45216ed5ac3f9e0a478d3c354d353d58");

      // Check URL params for initial query
      const params = new URLSearchParams(window.location.search);
      const q = params.get('query');
      if (q) {
        searchQuery = q;
        performSearch();
      }
    } catch (e) {
      console.error('Algolia init failed:', e);
    }
  });

  async function performSearch() {
    if (!searchClient || !searchQuery.trim()) {
      if (!searchQuery.trim()) {
        results = [];
        hasSearched = false;
        totalResults = 0;
      }
      return;
    }

    isLoading = true;
    hasSearched = true;

    try {
      const index = searchClient.initIndex(algoliaIndex);
      const response = await index.search(searchQuery.trim(), {
        hitsPerPage: 100,
      });

      results = response.hits || [];
      totalResults = response.nbHits || results.length;
    } catch (e) {
      console.error('Search failed:', e);
      results = [];
      totalResults = 0;
    }

    isLoading = false;
  }

  function handleSearchInput(e: Event) {
    searchQuery = (e.target as HTMLInputElement).value;
  }

  function handleSearchSubmit(e?: Event) {
    e?.preventDefault();
    if (searchQuery.trim()) {
      // Update URL
      const url = new URL(window.location.href);
      url.searchParams.set('query', searchQuery.trim());
      history.pushState({}, '', url.toString());
      performSearch();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSearchSubmit();
  }

  function clearSearch() {
    searchQuery = '';
    results = [];
    hasSearched = false;
    totalResults = 0;
    const url = new URL(window.location.href);
    url.searchParams.delete('query');
    history.pushState({}, '', url.toString());
  }

  function toggleGenre(genre: string) {
    const idx = selectedGenres.indexOf(genre);
    if (idx === -1) {
      selectedGenres = [...selectedGenres, genre];
    } else {
      selectedGenres = selectedGenres.filter(g => g !== genre);
    }
  }

  function clearAllFilters() {
    selectedGenres = [];
    selectedStatus = '';
    selectedYear = '';
  }

  function navigateToShow(item: any) {
    navigateWithTransition(`/show/${item.id ? encodeURIComponent(item.id) : ''}`);
  }

  // Filtered + sorted results
  $: filteredResults = (() => {
    let filtered = [...results];

    if (selectedGenres.length > 0) {
      filtered = filtered.filter(item =>
        item.tags && selectedGenres.some(g =>
          item.tags.some((t: string) => t.toLowerCase().includes(g.toLowerCase()))
        )
      );
    }

    if (selectedStatus) {
      filtered = filtered.filter(item =>
        item.anime_status === selectedStatus || item.status === selectedStatus
      );
    }

    if (selectedYear) {
      filtered = filtered.filter(item => {
        const year = item.start_date ? new Date(item.start_date).getFullYear() : null;
        return year === parseInt(selectedYear);
      });
    }

    // Sort
    if (sortBy === 'score') {
      filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (sortBy === 'newest') {
      filtered.sort((a, b) => {
        const da = a.start_date ? new Date(a.start_date).getTime() : 0;
        const db = b.start_date ? new Date(b.start_date).getTime() : 0;
        return db - da;
      });
    } else if (sortBy === 'title') {
      filtered.sort((a, b) => (a.title_en || '').localeCompare(b.title_en || ''));
    }

    return filtered;
  })();

  $: hasActiveFilters = selectedGenres.length > 0 || selectedStatus !== '' || selectedYear !== '';

  $: visibleGenres = showAllGenres ? GENRES : GENRES.slice(0, 10);

  // Generate year options
  $: yearOptions = (() => {
    const years = [];
    for (let y = new Date().getFullYear() + 1; y >= 1990; y--) {
      years.push(y);
    }
    return years;
  })();
</script>

<div class="search-page">
  <!-- Search Hero -->
  <section class="search-hero">
    <h1>Browse Anime</h1>
    <div class="search-bar-wrap" class:focused={false}>
      <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        type="text"
        class="search-bar-input"
        placeholder="Search by title, studio, genre..."
        autocomplete="off"
        spellcheck="false"
        bind:value={searchQuery}
        on:keydown={handleKeyDown}
        on:focus={() => { const wrap = document.querySelector('.search-bar-wrap'); if(wrap) wrap.classList.add('focused'); }}
        on:blur={() => { const wrap = document.querySelector('.search-bar-wrap'); if(wrap) wrap.classList.remove('focused'); }}
      />
      {#if searchQuery}
        <button class="search-bar-clear" on:click={clearSearch} aria-label="Clear search">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      {/if}
    </div>
  </section>

  <!-- Filter Bar -->
  <section class="filter-section">
    <div class="filter-bar">
      <span class="filter-label">Genres</span>
      <div class="genre-scroll">
        {#each visibleGenres as genre}
          <button
            class="genre-tag"
            class:selected={selectedGenres.includes(genre)}
            on:click={() => toggleGenre(genre)}
          >{genre}</button>
        {/each}
        {#if !showAllGenres && GENRES.length > 10}
          <button class="genre-tag genre-tag--more" on:click={() => showAllGenres = true}>
            +{GENRES.length - 10} more
          </button>
        {/if}
      </div>

      <div class="filter-divider"></div>

      <!-- Status -->
      <select class="filter-select" bind:value={selectedStatus} on:change={performSearch}>
        {#each STATUSES as status}
          <option value={status.value}>{status.label}</option>
        {/each}
      </select>

      <!-- Year -->
      <select class="filter-select" bind:value={selectedYear} on:change={performSearch}>
        <option value="">All years</option>
        {#each yearOptions as year}
          <option value={year.toString()}>{year}</option>
        {/each}
      </select>

      <!-- Sort -->
      <select class="filter-select" bind:value={sortBy}>
        {#each SORT_OPTIONS as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>
  </section>

  <!-- Active Filters -->
  {#if hasActiveFilters}
    <section class="active-filters-section">
      <div class="active-filters">
        <span class="active-filters-label">Active filters:</span>
        {#each selectedGenres as genre}
          <button class="filter-pill" on:click={() => toggleGenre(genre)}>
            {genre}
            <span class="filter-pill-remove">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </span>
          </button>
        {/each}
        {#if selectedStatus}
          <button class="filter-pill" on:click={() => { selectedStatus = ''; }}>
            {STATUSES.find(s => s.value === selectedStatus)?.label}
            <span class="filter-pill-remove">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </span>
          </button>
        {/if}
        {#if selectedYear}
          <button class="filter-pill" on:click={() => { selectedYear = ''; }}>
            {selectedYear}
            <span class="filter-pill-remove">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </span>
          </button>
        {/if}
        <button class="clear-all-btn" on:click={clearAllFilters}>Clear all</button>
      </div>
    </section>
  {/if}

  <!-- Results Header -->
  {#if hasSearched}
    <div class="results-header">
      <p class="results-count">
        <strong>{filteredResults.length}</strong>
        {filteredResults.length === 1 ? 'result' : 'results'}
        {#if searchQuery}for '{searchQuery}'{/if}
      </p>
      <div class="view-toggle" role="group" aria-label="View mode">
        <button
          class="view-toggle-btn"
          class:active={viewMode === 'grid'}
          title="Grid view"
          on:click={() => viewMode = 'grid'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        </button>
        <button
          class="view-toggle-btn"
          class:active={viewMode === 'list'}
          title="List view"
          on:click={() => viewMode = 'list'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
    </div>
  {/if}

  <!-- Results -->
  {#if isLoading}
    <div class="results-grid">
      {#each Array(12) as _}
        <div class="skeleton-card">
          <div class="skeleton-poster"></div>
          <div class="skeleton-title"></div>
          <div class="skeleton-meta"></div>
        </div>
      {/each}
    </div>
  {:else if hasSearched && filteredResults.length === 0}
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <h3>No results found</h3>
      <p>Try adjusting your filters or search term.</p>
    </div>
  {:else if hasSearched}
    {#if viewMode === 'grid'}
      <div class="results-grid">
        {#each filteredResults as item (item.objectID)}
          <a class="result-card" href="/show/{item.id ? encodeURIComponent(item.id) : ''}" on:click|preventDefault={() => navigateToShow(item)}>
            <div class="result-poster">
              <SafeImage
                src={GetImageFromAnime(item)}
                alt={item.title_en || ''}
                fallbackSrc="/assets/not found.jpg"
                className="result-poster-img"
              />
              {#if item.score}
                <span class="result-score">{item.score?.toFixed?.(1) || item.score}</span>
              {/if}
            </div>
            <div class="result-info">
              <div class="result-title">{item.title_en || item.title_jp || ''}</div>
              <div class="result-meta">
                {#if getYearUTC(item.start_date)}{getYearUTC(item.start_date)}{/if}
                {#if item.episode_count} · {item.episode_count} eps{/if}
              </div>
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <div class="results-list">
        {#each filteredResults as item (item.objectID)}
          <a class="list-item" href="/show/{item.id ? encodeURIComponent(item.id) : ''}" on:click|preventDefault={() => navigateToShow(item)}>
            <div class="list-poster">
              <SafeImage
                src={GetImageFromAnime(item)}
                alt={item.title_en || ''}
                fallbackSrc="/assets/not found.jpg"
                className="list-poster-img"
                width="52"
                height="78"
              />
            </div>
            <div class="list-info">
              <div class="list-title">{item.title_en || item.title_jp || ''}</div>
              <div class="list-sub">
                {#if getYearUTC(item.start_date)}{getYearUTC(item.start_date)}{/if}
                {#if item.episode_count} · {item.episode_count} episodes{/if}
                {#if item.studios?.[0]} · {item.studios[0]}{/if}
              </div>
              {#if item.description}
                <div class="list-desc">{@html item.description?.slice(0, 180)}{item.description?.length > 180 ? '...' : ''}</div>
              {/if}
            </div>
            {#if item.score}
              <div class="list-score">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {item.score?.toFixed?.(1) || item.score}
              </div>
            {/if}
          </a>
        {/each}
      </div>
    {/if}
  {:else}
    <!-- Initial state — no search yet -->
    <div class="initial-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <h3>Search for anime</h3>
      <p>Type a title, studio, or genre to get started.</p>
    </div>
  {/if}
</div>

<style>
  .search-page {
    width: 100%;
    padding: 0 var(--weeb-section-px, 48px);
  }

  /* Search Hero */
  .search-hero {
    padding: 48px 0 32px;
    text-align: center;
  }
  .search-hero h1 {
    font-size: clamp(1.5rem, 3vw, 2rem);
    font-weight: 600;
    letter-spacing: -0.025em;
    margin-bottom: 20px;
    color: var(--weeb-fg);
  }
  .search-bar-wrap {
    position: relative;
    max-width: 720px;
    margin: 0 auto;
  }
  .search-icon {
    position: absolute;
    left: 24px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--weeb-fg-muted);
    pointer-events: none;
    transition: color 0.2s;
  }
  .search-bar-wrap:focus-within .search-icon {
    color: var(--weeb-accent);
  }
  .search-bar-input {
    width: 100%;
    height: 56px;
    border: 1px solid var(--weeb-border);
    border-radius: 28px;
    padding: 0 56px 0 56px;
    font-size: 16px;
    color: var(--weeb-fg);
    background: var(--weeb-surface);
    transition: border-color 0.2s, box-shadow 0.2s;
    font-family: var(--weeb-font);
  }
  .search-bar-input:focus {
    outline: none;
    border-color: var(--weeb-accent);
    box-shadow: 0 0 0 4px oklch(55% 0.15 280 / 0.12);
  }
  .search-bar-input::placeholder { color: var(--weeb-fg-muted); }
  .search-bar-clear {
    position: absolute;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--weeb-fg-muted);
    background: var(--weeb-border);
    border: none;
    cursor: pointer;
    transition: all 0.15s;
  }
  .search-bar-clear:hover {
    background: var(--weeb-surface-hover);
    color: var(--weeb-fg);
  }

  /* Filter Section */
  .filter-section { padding: 16px 0 0; }
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .filter-label {
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--weeb-fg-muted);
    white-space: nowrap;
    margin-right: 4px;
  }
  .genre-scroll {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }
  .genre-tag {
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 14px;
    border-radius: 16px;
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    border: 1px solid var(--weeb-border);
    background: transparent;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    font-family: var(--weeb-font);
  }
  .genre-tag:hover {
    border-color: var(--weeb-accent);
    color: var(--weeb-fg);
    background: oklch(55% 0.15 280 / 0.08);
  }
  .genre-tag.selected {
    background: oklch(55% 0.15 280 / 0.15);
    border-color: var(--weeb-accent);
    color: var(--weeb-accent);
  }
  .genre-tag--more {
    border-style: dashed;
    color: var(--weeb-fg-muted);
  }
  .filter-divider {
    width: 1px;
    height: 24px;
    background: var(--weeb-border);
    flex-shrink: 0;
    margin: 0 4px;
  }
  .filter-select {
    height: 32px;
    padding: 0 28px 0 12px;
    border: 1px solid var(--weeb-border);
    border-radius: 16px;
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    background: transparent;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237a7a8a' stroke-width='2.5' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    font-family: var(--weeb-font);
    transition: all 0.15s;
  }
  .filter-select:hover {
    border-color: var(--weeb-fg-muted);
    color: var(--weeb-fg);
  }
  .filter-select:focus {
    outline: none;
    border-color: var(--weeb-accent);
  }

  /* Active Filters */
  .active-filters-section { padding: 12px 0; }
  .active-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .active-filters-label {
    font-size: 12px;
    color: var(--weeb-fg-muted);
    font-weight: 500;
  }
  .filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border-radius: 14px;
    font-size: 12px;
    font-weight: 500;
    background: oklch(55% 0.15 280 / 0.12);
    color: var(--weeb-accent);
    border: 1px solid oklch(55% 0.15 280 / 0.25);
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--weeb-font);
  }
  .filter-pill:hover { background: oklch(55% 0.15 280 / 0.18); }
  .filter-pill-remove {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--weeb-accent);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .clear-all-btn {
    font-size: 12px;
    color: var(--weeb-fg-muted);
    text-decoration: underline;
    text-underline-offset: 2px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--weeb-font);
    transition: color 0.15s;
  }
  .clear-all-btn:hover { color: var(--weeb-fg); }

  /* Results Header */
  .results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 0 24px;
    border-top: 1px solid var(--weeb-border);
  }
  .results-count {
    font-family: var(--weeb-font-mono);
    font-size: 13px;
    color: var(--weeb-fg-muted);
    letter-spacing: -0.01em;
  }
  .results-count :global(strong) {
    color: var(--weeb-fg);
    font-weight: 600;
  }
  .view-toggle {
    display: flex;
    gap: 2px;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    padding: 3px;
    background: var(--weeb-surface);
    flex-shrink: 0;
  }
  .view-toggle-btn {
    width: 34px;
    height: 30px;
    border-radius: calc(var(--weeb-radius) - 2px);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--weeb-fg-muted);
    border: none;
    background: none;
    cursor: pointer;
    transition: all 0.15s;
  }
  .view-toggle-btn.active {
    background: var(--weeb-accent);
    color: white;
  }
  .view-toggle-btn:hover:not(.active) {
    color: var(--weeb-fg);
    background: var(--weeb-surface-hover);
  }

  /* Results Grid */
  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 20px;
  }
  .result-card {
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    transition: transform 0.2s;
  }
  .result-card:hover { transform: translateY(-4px); }
  .result-poster {
    width: 100%;
    aspect-ratio: 2 / 3;
    border-radius: var(--weeb-radius-lg);
    overflow: hidden;
    position: relative;
    background: var(--weeb-surface);
  }
  .result-poster :global(.result-poster-img) {
    width: 100%;
    height: 100%;
  }
  .result-poster :global(.result-poster-img img) {
    object-fit: cover;
  }
  .result-score {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 3px 8px;
    border-radius: 6px;
    font-family: var(--weeb-font-mono);
    font-size: 11px;
    font-weight: 700;
    background: oklch(14% 0.015 275 / 0.85);
    color: var(--weeb-amber);
    backdrop-filter: blur(8px);
  }
  .result-info { padding: 10px 2px 0; }
  .result-title {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    color: var(--weeb-fg);
    min-height: calc(2 * 1.3em);
  }
  .result-card:hover .result-title { color: var(--weeb-accent); }
  .result-meta {
    font-size: 12px;
    color: var(--weeb-fg-muted);
    margin-top: 4px;
  }

  /* Results List */
  .results-list {
    display: flex;
    flex-direction: column;
  }
  .list-item {
    display: flex;
    gap: 16px;
    padding: 16px 0;
    border-bottom: 1px solid var(--weeb-border);
    text-decoration: none;
    color: inherit;
    transition: background 0.15s;
    cursor: pointer;
  }
  .list-item:hover { background: var(--weeb-surface); margin: 0 -16px; padding: 16px 16px; }
  .list-item:hover .list-title { color: var(--weeb-accent); }
  .list-poster {
    width: 52px;
    height: 78px;
    flex-shrink: 0;
    border-radius: var(--weeb-radius);
    overflow: hidden;
    background: var(--weeb-surface);
  }
  .list-poster :global(.list-poster-img) {
    width: 100%;
    height: 100%;
  }
  .list-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .list-title {
    font-size: 15px;
    font-weight: 500;
    color: var(--weeb-fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.15s;
  }
  .list-sub {
    font-size: 13px;
    color: var(--weeb-fg-muted);
    margin-top: 2px;
  }
  .list-desc {
    font-size: 13px;
    color: var(--weeb-fg-secondary);
    margin-top: 4px;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .list-score {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--weeb-font-mono);
    font-size: 14px;
    font-weight: 600;
    color: var(--weeb-amber);
    flex-shrink: 0;
    align-self: center;
  }

  /* Skeleton */
  .skeleton-card {}
  .skeleton-poster {
    width: 100%;
    aspect-ratio: 2 / 3;
    border-radius: var(--weeb-radius-lg);
    background: var(--weeb-surface);
    animation: pulse 1.5s ease-in-out infinite;
  }
  .skeleton-title {
    height: 14px;
    width: 80%;
    background: var(--weeb-surface);
    border-radius: 4px;
    margin-top: 10px;
    animation: pulse 1.5s ease-in-out infinite;
  }
  .skeleton-meta {
    height: 12px;
    width: 50%;
    background: var(--weeb-surface);
    border-radius: 4px;
    margin-top: 6px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  /* Empty + Initial State */
  .empty-state, .initial-state {
    text-align: center;
    padding: 64px 0;
    color: var(--weeb-fg-muted);
  }
  .empty-state svg, .initial-state svg {
    margin: 0 auto 24px;
    opacity: 0.3;
    display: block;
  }
  .empty-state h3, .initial-state h3 {
    font-size: 1.25rem;
    color: var(--weeb-fg);
    margin-bottom: 8px;
    font-weight: 500;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.7; }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .search-page { padding: 0 16px; }
    .search-hero { padding: 32px 0 24px; }
    .filter-bar { gap: 6px; }
    .filter-divider { display: none; }
    .results-grid { gap: 12px; }
  }
  @media (max-width: 480px) {
    .search-page { padding: 0 12px; }
    .search-hero { padding: 24px 0 16px; }
    .search-bar-input { height: 48px; font-size: 14px; border-radius: 24px; padding: 0 48px 0 48px; }
    .search-icon { left: 18px; }
    .search-bar-clear { right: 14px; }
    .results-grid { gap: 10px; }
    .list-desc { display: none; }
    .list-poster { width: 44px; height: 66px; }
  }
</style>
