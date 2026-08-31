<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { configStore } from '../stores/config';
  import { loggedInStore } from '../stores/auth';
  import PosterCard from './PosterCard.svelte';
  import Select from './Select.svelte';
  import SafeImage from './SafeImage.svelte';
  import { GetImageFromAnime, animeHref } from '../../services/utils';
  import { AuthStorage } from '../../utils/auth-storage';
  import { workSubtitle } from '../../utils/workDisplay';
  import { Status } from '../../gql/graphql';
  let searchQuery = '';
  let results: any[] = [];
  let isLoading = false;
  let hasSearched = false;
  let totalResults = 0;
  let currentPage = 0;
  let perPage = 24;
  const PAGE_SIZE_OPTIONS = [24, 48, 72, 100];

  // User anime lookup map (animeId -> status)
  let userAnimeMap: Map<string, string> = new Map();

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
  // Empty when unconfigured, which is the signal to skip the works request
  // entirely rather than query an index that may not exist.
  let worksIndex: string = '';
  let workResults: any[] = [];

  // A work is reachable only by slug -- workBySlug is the only lookup the
  // schema exposes, and there is no id route to fall back on the way anime
  // have. One without a slug would render a card leading to a certain 404, so
  // it is left out rather than shown.
  $: linkableWorks = workResults.filter((w: any) => !!w?.slug);

  function workSub(work: any): string {
    return workSubtitle(work?.type, work?.published_from);
  }

  // Parse JSON string fields from Algolia (genres, studios, licensors come as JSON strings)
  function parseJsonField(val: any): string[] {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return []; }
    }
    return [];
  }

  // Normalize an Algolia hit into consistent field names
  function normalizeHit(hit: any): any {
    return {
      ...hit,
      // Algolia field -> our field
      description: hit.synopsis || hit.description || '',
      tags: parseJsonField(hit.genres || hit.tags),
      studiosList: parseJsonField(hit.studios),
      episodeCount: hit.episodes || hit.episode_count || null,
      ratingNum: hit.rating ? parseFloat(hit.rating) : null,
      yearNum: hit.year || (hit.start_date ? new Date(hit.start_date).getFullYear() : null),
    };
  }

  // Genres extracted dynamically from search results
  let allGenres: string[] = [];

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

  // Genre metadata for icons and colors (used to enhance dynamically fetched genres)
  const GENRE_META: Record<string, { icon: string; hue: number }> = {
    'Action': { icon: '⚔️', hue: 25 },
    'Adventure': { icon: '🗺️', hue: 85 },
    'Comedy': { icon: '😂', hue: 60 },
    'Drama': { icon: '🎭', hue: 320 },
    'Fantasy': { icon: '✨', hue: 280 },
    'Horror': { icon: '👻', hue: 0 },
    'Mystery': { icon: '🔍', hue: 240 },
    'Romance': { icon: '💕', hue: 350 },
    'Sci-Fi': { icon: '🚀', hue: 200 },
    'Slice of Life': { icon: '☀️', hue: 45 },
    'Sports': { icon: '⚽', hue: 155 },
    'Supernatural': { icon: '👁️', hue: 270 },
    'Thriller': { icon: '🔪', hue: 15 },
    'Mecha': { icon: '🤖', hue: 180 },
    'Music': { icon: '🎵', hue: 300 },
    'Psychological': { icon: '🧠', hue: 260 },
    'Ecchi': { icon: '🔥', hue: 350 },
    'Seinen': { icon: '👔', hue: 220 },
    'Shounen': { icon: '💪', hue: 40 },
    'Shoujo': { icon: '🌸', hue: 330 },
    'Josei': { icon: '👠', hue: 310 },
    'Kids': { icon: '🧸', hue: 50 },
    'Isekai': { icon: '🌀', hue: 190 },
    'Harem': { icon: '💝', hue: 340 },
    'School': { icon: '🏫', hue: 100 },
    'Military': { icon: '🎖️', hue: 120 },
    'Historical': { icon: '📜', hue: 35 },
    'Parody': { icon: '🎪', hue: 55 },
    'Dementia': { icon: '🌀', hue: 275 },
    'Game': { icon: '🎮', hue: 160 },
    'Hentai': { icon: '🔞', hue: 5 },
    'Samurai': { icon: '⚔️', hue: 30 },
    'Vampire': { icon: '🧛', hue: 355 },
    'Martial Arts': { icon: '🥋', hue: 20 },
    'Space': { icon: '🌌', hue: 250 },
    'Super Power': { icon: '⚡', hue: 65 },
    'Police': { icon: '🚔', hue: 210 },
    'Magic': { icon: '🪄', hue: 285 },
    'Demons': { icon: '👿', hue: 10 },
    'Cars': { icon: '🏎️', hue: 15 },
    'Avant Garde': { icon: '🎨', hue: 290 },
    'Suspense': { icon: '😰', hue: 30 },
    'Gourmet': { icon: '🍳', hue: 40 },
    'Award Winning': { icon: '🏆', hue: 50 },
    'Boys Love': { icon: '👬', hue: 195 },
    'Girls Love': { icon: '👭', hue: 335 },
    'Erotica': { icon: '💋', hue: 345 },
    'Adult Cast': { icon: '👔', hue: 215 },
    'Childcare': { icon: '👶', hue: 55 },
    'Combat Sports': { icon: '🥊', hue: 20 },
    'Delinquents': { icon: '😎', hue: 25 },
    'Detective': { icon: '🕵️', hue: 235 },
    'Educational': { icon: '📚', hue: 110 },
    'Gag Humor': { icon: '🤪', hue: 65 },
    'Gore': { icon: '🩸', hue: 5 },
    'High Stakes Game': { icon: '🎰', hue: 145 },
    'Idols (Female)': { icon: '👩‍🎤', hue: 325 },
    'Idols (Male)': { icon: '👨‍🎤', hue: 205 },
    'Iyashikei': { icon: '🌿', hue: 135 },
    'Love Polygon': { icon: '💔', hue: 355 },
    'Mahou Shoujo': { icon: '🪄', hue: 315 },
    'Medical': { icon: '🏥', hue: 175 },
    'Memoir': { icon: '📖', hue: 45 },
    'Organized Crime': { icon: '🔫', hue: 15 },
    'Otaku Culture': { icon: '🎌', hue: 0 },
    'Performing Arts': { icon: '🎭', hue: 305 },
    'Pets': { icon: '🐾', hue: 35 },
    'Racing': { icon: '🏁', hue: 10 },
    'Reincarnation': { icon: '🔄', hue: 265 },
    'Reverse Harem': { icon: '💖', hue: 330 },
    'Romantic Subtext': { icon: '💕', hue: 345 },
    'Showbiz': { icon: '⭐', hue: 55 },
    'Strategy Game': { icon: '♟️', hue: 225 },
    'Survival': { icon: '🏕️', hue: 125 },
    'Team Sports': { icon: '🏀', hue: 25 },
    'Time Travel': { icon: '⏰', hue: 185 },
    'Video Game': { icon: '🎮', hue: 165 },
    'Visual Arts': { icon: '🖼️', hue: 295 },
    'Workplace': { icon: '💼', hue: 220 },
    'Mythology': { icon: '⚡', hue: 70 },
    'Shounen Ai': { icon: '💙', hue: 200 },
    'Shoujo Ai': { icon: '💗', hue: 340 },
    'Yaoi': { icon: '💙', hue: 200 },
    'Yuri': { icon: '💗', hue: 340 },
  };

  // Dynamically fetched genres from Algolia
  let browseGenres: { name: string; count: number }[] = [];
  let isLoadingGenres = true;
  let showAllBrowseGenres = false;
  const INITIAL_GENRE_COUNT = 16;

  async function fetchBrowseGenres() {
    if (!searchClient) return;

    isLoadingGenres = true;
    try {
      // Use Algolia facets to get all genres with accurate counts
      const response = await searchClient.search({
        requests: [{
          indexName: algoliaIndex,
          query: '',
          hitsPerPage: 0,
          // 'tags', not 'genres': the search document renamed the field to
          // match what the rest of the app calls it, and only configured
          // facets can be requested -- asking for 'genres' now returns
          // nothing, so the browse list silently came back empty.
          facets: ['tags'],
        }]
      });

      const facets = response.results?.[0]?.facets?.tags || {};

      // Convert facets to array
      browseGenres = Object.entries(facets)
        .filter(([name]) => {
          // Filter out invalid genres
          if (!name || name === 'None found' || name.trim() === '' || name === ' add some') return false;
          // Filter out duplicate/malformed genres (e.g., "FantasyFantasy")
          const len = name.length;
          const half = Math.floor(len / 2);
          if (len > 2 && len % 2 === 0 && name.slice(0, half) === name.slice(half)) return false;
          return true;
        })
        .map(([name, count]) => ({
          name,
          count: count as number,
        }))
        .sort((a, b) => b.count - a.count);

    } catch (e) {
      console.error('Failed to fetch genres:', e);
      browseGenres = [];
    }
    isLoadingGenres = false;
  }

  function browseGenre(genreName: string) {
    // Toggle genre selection. Single select for now.
    const next = selectedGenres.includes(genreName) ? [] : [genreName];
    const url = new URL(window.location.href);
    if (next.length > 0) {
      url.searchParams.set('genre', next[0]);
    } else {
      url.searchParams.delete('genre');
    }
    if (!searchQuery) {
      url.searchParams.delete('query');
    }
    // Write the URL only — syncFromUrl() derives state and runs the search.
    applyUrl(url);
  }

  async function fetchUserAnimeMap() {
    if (!AuthStorage.isLoggedIn()) return;
    try {
      const { ensureConfigLoaded } = await import('../../services/config-loader');
      await ensureConfigLoaded();
      const { AuthenticatedClient } = await import('../../services/queries');
      const { queryUserAnimes } = await import('../../services/api/graphql/queries');
      const client = await AuthenticatedClient();

      // Fetch all statuses in parallel
      const statuses = [Status.Watching, Status.Completed, Status.Plantowatch, Status.Dropped, Status.Onhold];
      const responses = await Promise.all(
        statuses.map(status =>
          client.request(queryUserAnimes, { input: { status, limit: 1000, page: 1 } })
            .then(r => r.UserAnimes?.animes || [])
            .catch(() => [])
        )
      );

      const map = new Map<string, string>();
      responses.forEach((animes, i) => {
        const statusStr = statuses[i];
        animes.forEach((entry: any) => {
          if (entry.anime?.id) {
            map.set(entry.anime.id, statusStr);
          }
        });
      });

      userAnimeMap = map;
    } catch (e) {
      console.error('Failed to fetch user anime map:', e);
    }
  }

  onMount(async () => {
    try {
      await configStore.init();
    } catch (e) {
      console.error('Config init failed:', e);
    }

    // Fetch user anime list in parallel with Algolia init
    fetchUserAnimeMap();

    try {
      const algoliasearchModule = await import('algoliasearch/lite');
      if ('default' in algoliasearchModule && typeof algoliasearchModule.default === 'function') {
        algoliasearch = algoliasearchModule.default;
      } else if (algoliasearchModule.liteClient) {
        algoliasearch = algoliasearchModule.liteClient;
      }

      const config = configStore.get();
      algoliaIndex = config?.algolia_index || 'anime-staging';
      worksIndex = config?.algolia_works_index || '';
      searchClient = algoliasearch("A2HF2P5C6X", "45216ed5ac3f9e0a478d3c354d353d58");

      // Fetch browse genres in the background
      fetchBrowseGenres();

      // Check URL params for initial query and genre
      const params = new URLSearchParams(window.location.search);
      const q = params.get('query');
      const genre = params.get('genre');

      if (genre) {
        selectedGenres = [genre];
      }

      if (q) {
        searchQuery = q;
      }
      // Perform search if we have a query or genre filter
      if (q || genre) {
        performSearch();
      }
      // Seed the sync block with what we just applied, so enabling it below
      // doesn't immediately re-run this same search.
      lastSeenSearch = window.location.search;
      initializedFromUrl = true;
    } catch (e) {
      console.error('Algolia init failed:', e);
    }
  });

  // The URL is the single source of truth for `searchQuery` and `selectedGenres`.
  // Handlers never write those directly — they call applyUrl(), and this block
  // derives the state and runs the search once the store has actually updated.
  //
  // Do NOT set `lastSeenSearch` from a handler ahead of the navigation: the
  // reactive block can run while `$page.url` still holds the previous URL, and
  // a pre-advanced `lastSeenSearch` makes it "correct" the state back to that
  // stale URL, wiping the selection that was just made.
  let initializedFromUrl = false;
  let lastSeenSearch = '';

  function applyUrl(url: URL) {
    // Must be goto(), not replaceState(). `replaceState` from $app/navigation is
    // shallow routing: it swaps the history entry and sets `$page.state`, but
    // leaves `$page.url` pointing at the old URL — so the sync block below would
    // never see the new query/genre. goto() performs a real (client-side)
    // navigation, which is what actually updates `$page.url`.
    goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

  $: if (initializedFromUrl && $page.url.pathname === '/search' && $page.url.search !== lastSeenSearch) {
    lastSeenSearch = $page.url.search;
    const q = $page.url.searchParams.get('query') || '';
    const genre = $page.url.searchParams.get('genre');
    searchQuery = q;
    selectedGenres = genre ? [genre] : [];
    performSearch();
  }

  async function performSearch(resetPage = true) {
    // Allow search if we have a query OR selected genres
    if (!searchClient || (!searchQuery.trim() && selectedGenres.length === 0)) {
      results = [];
      workResults = [];
      hasSearched = false;
      totalResults = 0;
      currentPage = 0;
      return;
    }

    if (resetPage) {
      currentPage = 0;
    }

    isLoading = true;
    hasSearched = true;

    try {
      // Build filters for selected genres
      const filters = selectedGenres.length > 0
        ? selectedGenres.map(g => `tags:"${g}"`).join(' OR ')
        : undefined;

      // Works are fetched alongside anime in the same round trip -- `requests`
      // has always been an array. They are skipped when a genre filter is on,
      // because `tags` is an anime facet that no work carries, and on later
      // pages, because pagination here walks the anime results and a repeated
      // works section under page 4 would be noise.
      const wantWorks = !!worksIndex && !!searchQuery.trim() &&
        selectedGenres.length === 0 && currentPage === 0;

      const requests: any[] = [{
        indexName: algoliaIndex,
        query: searchQuery.trim(),
        hitsPerPage: perPage,
        page: currentPage,
        filters,
      }];
      if (wantWorks) {
        requests.push({
          indexName: worksIndex,
          query: searchQuery.trim(),
          hitsPerPage: 6,
        });
      }

      const response = await searchClient.search({ requests });

      workResults = wantWorks ? (response.results?.[1]?.hits || []) : [];

      // Algolia v5 response may have results at different paths
      const firstResult = response.results?.[0] || response;
      const rawHits = firstResult?.hits || [];
      totalResults = firstResult?.nbHits ?? firstResult?.totalHits ?? rawHits.length;

      // Normalize all hits — parse JSON string fields, unify field names
      results = rawHits.map(normalizeHit);

      // Extract unique genres dynamically from results
      const genreSet = new Set<string>();
      results.forEach(r => r.tags?.forEach((t: string) => {
        if (t && t !== 'None found' && t !== ' add some') genreSet.add(t);
      }));
      allGenres = Array.from(genreSet).sort();
    } catch (e) {
      console.error('Search failed:', e);
      results = [];
      workResults = [];
      totalResults = 0;
    }

    isLoading = false;
  }

  function goToPage(page: number) {
    currentPage = page;
    performSearch(false);
    // Scroll to top of results
    document.querySelector('.results-header')?.scrollIntoView({ behavior: 'smooth' });
  }

  $: totalPages = Math.ceil(totalResults / perPage);

  function handleSearchInput(e: Event) {
    searchQuery = (e.target as HTMLInputElement).value;
  }

  function handleSearchSubmit(e?: Event) {
    e?.preventDefault();
    if (searchQuery.trim()) {
      const url = new URL(window.location.href);
      url.searchParams.set('query', searchQuery.trim());
      applyUrl(url);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSearchSubmit();
  }

  function clearSearch() {
    // Clearing the params drives the sync block, which resets the state and
    // short-circuits performSearch() back to the browse placeholder.
    const url = new URL(window.location.href);
    url.searchParams.delete('query');
    url.searchParams.delete('genre');
    applyUrl(url);
  }

  function toggleGenre(genre: string) {
    const next = selectedGenres.includes(genre)
      ? selectedGenres.filter(g => g !== genre)
      : [...selectedGenres, genre];

    const url = new URL(window.location.href);
    if (next.length > 0) {
      url.searchParams.set('genre', next[0]);
    } else {
      url.searchParams.delete('genre');
      // Dropping the last genre with no query returns to the browse placeholder.
      if (!searchQuery) url.searchParams.delete('query');
    }
    applyUrl(url);
  }

  function clearAllFilters() {
    // Status and year are not URL-backed, so they still reset directly.
    selectedStatus = '';
    selectedYear = '';
    // Query and genre are URL-backed — the sync block clears them.
    const url = new URL(window.location.href);
    url.searchParams.delete('query');
    url.searchParams.delete('genre');
    applyUrl(url);
  }

  // Algolia records are the CDC payload verbatim, so the slug arrives as
  // url_slug rather than the camelCase the GraphQL types use.
  function hrefFor(item: any) {
    return animeHref({ id: item?.id, slug: item?.url_slug ?? item?.slug });
  }

  function navigateToShow(item: any) {
    goto(hrefFor(item));
  }

  // Filtered + sorted results
  $: filteredResults = (() => {
    let filtered = [...results];

    if (selectedGenres.length > 0) {
      filtered = filtered.filter(item =>
        item.tags && selectedGenres.some(g =>
          item.tags.some((t: string) => t.toLowerCase() === g.toLowerCase())
        )
      );
    }

    if (selectedStatus) {
      filtered = filtered.filter(item => item.status === selectedStatus);
    }

    if (selectedYear) {
      filtered = filtered.filter(item => item.yearNum === parseInt(selectedYear));
    }

    // Sort
    if (sortBy === 'score') {
      filtered.sort((a, b) => (b.ratingNum || 0) - (a.ratingNum || 0));
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

  $: visibleGenres = showAllGenres ? allGenres : allGenres.slice(0, 10);

  // Generate year options
  $: yearOptions = (() => {
    const years: number[] = [];
    for (let y = new Date().getFullYear() + 1; y >= 1990; y--) {
      years.push(y);
    }
    return years;
  })();

  // The Select takes {value,label} pairs. Year and page size are plain numbers,
  // so they are shaped here rather than in the markup.
  $: yearSelectOptions = [
    { value: '', label: 'All years' },
    ...yearOptions.map((y: number) => ({ value: y.toString(), label: y.toString() })),
  ];

  const pageSizeSelectOptions = PAGE_SIZE_OPTIONS.map((n) => ({ value: n, label: String(n) }));
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
    <div class="filter-row filter-row--genres">
      <span class="filter-label">Genres</span>
      {#if isLoadingGenres}
        <div class="genre-scroll">
          {#each Array(8) as _}
            <div class="genre-tag-skeleton"></div>
          {/each}
        </div>
      {:else if browseGenres.length > 0}
        {@const visibleBrowseGenres = showAllBrowseGenres ? browseGenres : browseGenres.slice(0, 12)}
        <div class="genre-scroll">
          {#each visibleBrowseGenres as genre}
            <button
              class="genre-tag"
              class:selected={selectedGenres.includes(genre.name)}
              on:click={() => browseGenre(genre.name)}
            >
              {genre.name}
              <span class="genre-tag-count">{genre.count.toLocaleString()}</span>
            </button>
          {/each}
          {#if browseGenres.length > 12 && !showAllBrowseGenres}
            <button class="genre-tag genre-tag--more" on:click={() => showAllBrowseGenres = true}>
              +{browseGenres.length - 12} more
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <div class="filter-row filter-row--controls">
      <!-- Status -->
      <Select
        bind:value={selectedStatus}
        options={STATUSES}
        ariaLabel="Filter by status"
        on:change={() => performSearch()}
      />

      <!-- Year -->
      <Select
        bind:value={selectedYear}
        options={yearSelectOptions}
        ariaLabel="Filter by year"
        on:change={() => performSearch()}
      />

      <!-- Sort -->
      <Select bind:value={sortBy} options={SORT_OPTIONS} ariaLabel="Sort results" />
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
        <strong>{totalResults.toLocaleString()}</strong>
        {totalResults === 1 ? 'result' : 'results'}
        {#if searchQuery}for '{searchQuery}'{/if}
        {#if selectedGenres.length > 0 && !searchQuery}in {selectedGenres.join(', ')}{/if}
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
          <PosterCard
            id={item.id || ''}
            slug={item.url_slug ?? item.slug}
            title={item.title_en || item.title_jp || ''}
            image={GetImageFromAnime(item)}
            score={item.ratingNum}
            status={item.status || null}
            sub={[item.yearNum, item.studiosList?.[0]].filter(Boolean).join(' · ')}
            genres={item.tags || []}
            description={item.description || ''}
            episodeCount={item.episodeCount}
            onList={userAnimeMap.get(item.id) || null}
          />
        {/each}
      </div>
    {:else}
      <div class="results-list">
        {#each filteredResults as item (item.objectID)}
          <a class="list-item" href={hrefFor(item)} on:click|preventDefault={() => navigateToShow(item)}>
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
                {#if item.yearNum}{item.yearNum}{/if}
                {#if item.episodeCount} · {item.episodeCount} episodes{/if}
                {#if item.studiosList?.[0]} · {item.studiosList[0]}{/if}
              </div>
              {#if item.description}
                {@const desc = item.description.replace(/<[^>]*>/g, '')}
                <div class="list-desc">{desc.slice(0, 180)}{desc.length > 180 ? '...' : ''}</div>
              {/if}
              {#if item.tags?.length > 0}
                <div class="list-tags">
                  {#each item.tags.slice(0, 4) as tag}
                    <span class="list-tag">{tag}</span>
                  {/each}
                </div>
              {/if}
            </div>
            <div class="list-badges">
              {#if userAnimeMap.get(item.id)}
                {@const listStatus = userAnimeMap.get(item.id)}
                <span class="list-status-badge"
                  class:watching={listStatus === 'WATCHING'}
                  class:completed={listStatus === 'COMPLETED'}
                  class:plan={listStatus === 'PLANTOWATCH'}
                  class:dropped={listStatus === 'DROPPED'}
                  class:onhold={listStatus === 'ONHOLD'}
                >
                  {listStatus === 'WATCHING' ? 'Watching' : listStatus === 'COMPLETED' ? 'Completed' : listStatus === 'PLANTOWATCH' ? 'Plan to Watch' : listStatus === 'DROPPED' ? 'Dropped' : listStatus === 'ONHOLD' ? 'On Hold' : ''}
                </span>
              {/if}
              {#if item.ratingNum}
                <div class="list-score">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  {item.ratingNum.toFixed(1)}
                </div>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {/if}

    <!-- Works: the manga, light novels and novels matching the same query.
         A separate section rather than mixed into the grid above, because the
         two indices are ranked independently and their scores are not
         comparable -- interleaving them would be inventing an order. Renders
         only when there are hits, so a query matching no works looks exactly
         as this page did before. -->
    {#if workResults.length > 0}
      <section class="works-section" aria-labelledby="works-heading">
        <h2 class="works-heading" id="works-heading">Manga &amp; light novels</h2>
        {#if viewMode === 'grid'}
          <div class="results-grid">
            {#each linkableWorks as work (work.objectID)}
              <PosterCard
                id={work.id || ''}
                title={work.title_en || work.title_jp || ''}
                image={work.id || ''}
                imagePath="works"
                score={work.score}
                sub={workSub(work)}
                description={work.description || ''}
                href={`/manga/${work.slug}`}
              />
            {/each}
          </div>
        {:else}
          <!-- The same list rows the anime results use, so switching view mode
               changes the whole page rather than half of it. -->
          <div class="results-list">
            {#each linkableWorks as work (work.objectID)}
              <a class="list-item" href={`/manga/${work.slug}`}>
                <div class="list-poster">
                  <SafeImage
                    src={work.id || ''}
                    path="works"
                    alt={work.title_en || work.title_jp || ''}
                    fallbackSrc={work.image_url || '/assets/not found.jpg'}
                    className="list-poster-img"
                    width="52"
                    height="78"
                  />
                </div>
                <div class="list-info">
                  <div class="list-title">{work.title_en || work.title_jp || ''}</div>
                  <div class="list-sub">
                    {workSub(work)}
                    {#if work.volumes} · {work.volumes} volumes{/if}
                    {#if work.chapters} · {work.chapters} chapters{/if}
                  </div>
                  {#if work.description}
                    {@const desc = work.description.replace(/<[^>]*>/g, '')}
                    <div class="list-desc">{desc.slice(0, 180)}{desc.length > 180 ? '...' : ''}</div>
                  {/if}
                  {#if work.authors?.length > 0}
                    <div class="list-tags">
                      {#each work.authors.slice(0, 3) as author}
                        <span class="list-tag">{author}</span>
                      {/each}
                    </div>
                  {/if}
                </div>
                <div class="list-badges">
                  {#if work.score}
                    <div class="list-score">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      {work.score.toFixed(1)}
                    </div>
                  {/if}
                </div>
              </a>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="pagination">
        <div class="pagination-left">
          <button
            class="page-btn"
            disabled={currentPage === 0}
            on:click={() => goToPage(currentPage - 1)}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            <span class="page-btn-label">Previous</span>
          </button>

          <span class="page-info">
            Page {currentPage + 1} of {totalPages.toLocaleString()}
          </span>

          <button
            class="page-btn"
            disabled={currentPage >= totalPages - 1}
            on:click={() => goToPage(currentPage + 1)}
          >
            <span class="page-btn-label">Next</span>
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>

        <div class="pagination-right">
          <label class="per-page-label" for="search-per-page">Show</label>
          <Select
            bind:value={perPage}
            options={pageSizeSelectOptions}
            ariaLabel="Results per page"
            on:change={() => { currentPage = 0; performSearch(false); }}
          />
          <span class="per-page-label">per page</span>
        </div>
      </div>
    {/if}
  {:else}
    <!-- Empty state — shown when no search yet -->
    <section class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <h3>Browse anime</h3>
      <p>Search by title or click a genre above to explore.</p>
    </section>
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
    color: var(--weeb-accent-text);
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
    box-shadow: 0 0 0 4px color-mix(in oklch, var(--weeb-accent) 12%, transparent);
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
  .filter-section { padding: 16px 0 8px; display: flex; flex-direction: column; gap: 12px; }
  .filter-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .filter-row--controls {
    gap: 10px;
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
    background: color-mix(in oklch, var(--weeb-accent) 8%, transparent);
  }
  .genre-tag.selected {
    background: color-mix(in oklch, var(--weeb-accent) 15%, transparent);
    border-color: var(--weeb-accent);
    color: var(--weeb-accent-text);
  }
  .genre-tag--more {
    border-style: dashed;
    color: var(--weeb-fg-muted);
  }
  .genre-tag-count {
    margin-left: 6px;
    font-size: 11px;
    font-weight: 400;
    color: var(--weeb-fg-muted);
    opacity: 0.7;
  }
  .genre-tag.selected .genre-tag-count {
    color: var(--weeb-accent-text);
    opacity: 0.8;
  }
  .genre-tag-skeleton {
    width: 80px;
    height: 32px;
    border-radius: 16px;
    background: var(--weeb-surface);
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.7; }
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
    background: color-mix(in oklch, var(--weeb-accent) 12%, transparent);
    color: var(--weeb-accent-text);
    border: 1px solid color-mix(in oklch, var(--weeb-accent) 25%, transparent);
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--weeb-font);
  }
  .filter-pill:hover { background: color-mix(in oklch, var(--weeb-accent) 18%, transparent); }
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
    margin-top: 16px;
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
  /* ── Works section ──
     Set apart from the anime grid rather than blended into it: the two indices
     rank independently, so presenting them as one list would imply an order
     that does not exist. */
  .works-section {
    margin-top: 40px;
    padding-top: 28px;
    border-top: 1px solid var(--weeb-border, rgba(255, 255, 255, 0.08));
  }
  .works-heading {
    margin: 0 0 16px;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--weeb-fg-muted, #8b8b8b);
  }

  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 20px;
    align-items: start;
  }
  .results-grid :global(.poster-card) {
    max-width: 200px;
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
  .list-item:hover .list-title { color: var(--weeb-accent-text); }
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
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .list-tags {
    display: flex;
    gap: 4px;
    margin-top: 4px;
    flex-wrap: wrap;
  }
  .list-tag {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: var(--weeb-radius-full, 9999px);
    background: color-mix(in oklch, var(--weeb-accent) 10%, transparent);
    color: var(--weeb-fg-secondary);
    border: 1px solid color-mix(in oklch, var(--weeb-accent) 15%, transparent);
  }
  .list-badges {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    align-self: center;
  }
  .list-status-badge {
    font-family: var(--weeb-font-mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: var(--weeb-radius-full, 999px);
    border: 1px solid var(--weeb-border);
    color: var(--weeb-fg-secondary);
    background: var(--weeb-surface);
  }
  .list-status-badge.watching { color: var(--weeb-green); border-color: var(--weeb-green); background: color-mix(in oklch, var(--weeb-green) 8%, transparent); }
  .list-status-badge.completed { color: var(--weeb-accent-text); border-color: var(--weeb-accent); background: color-mix(in oklch, var(--weeb-accent) 8%, transparent); }
  .list-status-badge.plan { color: var(--weeb-amber); border-color: var(--weeb-amber); background: color-mix(in oklch, var(--weeb-amber) 8%, transparent); }
  .list-status-badge.dropped { color: var(--weeb-red); border-color: var(--weeb-red); background: color-mix(in oklch, var(--weeb-red) 8%, transparent); }
  .list-status-badge.onhold { color: var(--weeb-fg-muted); border-color: var(--weeb-fg-muted); background: color-mix(in oklch, var(--weeb-fg-muted) 8%, transparent); }
  .list-score {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--weeb-font-mono);
    font-size: 14px;
    font-weight: 600;
    color: var(--weeb-amber);
    flex-shrink: 0;
  }

  /* Skeleton */
  .skeleton-poster {
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

  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 64px 0;
    color: var(--weeb-fg-muted);
  }
  .empty-state svg {
    margin: 0 auto 24px;
    opacity: 0.3;
    display: block;
  }
  .empty-state h3 {
    font-size: 1.25rem;
    color: var(--weeb-fg);
    margin-bottom: 8px;
    font-weight: 500;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.7; }
  }

  /* Pagination */
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 24px;
    margin-top: 8px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .pagination-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pagination-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .page-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    color: var(--weeb-fg-secondary);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    font-family: var(--weeb-font);
  }
  .page-btn:hover:not(:disabled) {
    border-color: var(--weeb-accent);
    color: var(--weeb-fg);
    background: var(--weeb-surface-hover);
  }
  .page-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .page-btn-label {
    display: inline;
  }
  .page-info {
    font-size: 0.8rem;
    color: var(--weeb-fg-muted);
    font-variant-numeric: tabular-nums;
    font-family: var(--weeb-font-mono, monospace);
  }
  .per-page-label {
    font-size: 0.75rem;
    color: var(--weeb-fg-muted);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .search-page { padding: 0 16px; }
    .search-hero { padding: 32px 0 24px; }
    .filter-row { gap: 6px; }
    .filter-row--controls { flex-wrap: wrap; }
    .results-grid { gap: 12px; }
  }
  @media (max-width: 768px) {
    .pagination { flex-direction: column; align-items: stretch; }
    .pagination-left { justify-content: center; }
    .pagination-right { justify-content: center; }
    .page-btn-label { display: none; }
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
