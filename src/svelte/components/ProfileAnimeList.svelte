<script lang="ts">
  import { onMount } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { fetchUserAnimes } from '../../services/queries';
  import { useAddAnimeWithToast, useDeleteAnimeWithToast } from '../utils/anime-actions';
  import { Status, type UserAnime } from '../../gql/graphql';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';
  import { navigateWithTransition } from '../../utils/astro-navigation';
  import { initializeQueryClient } from '../services/query-client';
  import PosterCard from './PosterCard.svelte';
  import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';

  // Initialize query client
  const queryClient = initializeQueryClient();

  // Subscribe to preferences for title language
  $: preferences = $preferencesStore;

  const PAGE_SIZE_OPTIONS = [24, 48, 72, 100];

  function getDefaultPageSize(): number {
    if (typeof window === 'undefined') return 48;
    const w = window.innerWidth;
    if (w >= 1920) return 72;
    if (w >= 1440) return 48;
    return 24;
  }

  let mounted = false;
  let selectedStatus = Status.Plantowatch;
  let page = 0;
  let perPage = getDefaultPageSize();

  // Status labels
  const statusLabels: Record<Status, string> = {
    [Status.Completed]: "Completed",
    [Status.Dropped]: "Dropped",
    [Status.Onhold]: "On Hold",
    [Status.Plantowatch]: "Plan to Watch",
    [Status.Watching]: "Watching"
  };

  // Client-side only queries and mutations
  let userAnimesQuery: any;
  let upsertAnimeMutation: any;
  let deleteAnimeMutation: any;

  // Reactive query input
  $: queryInput = {
    status: selectedStatus,
    limit: perPage,
    page: page + 1, // Shift from 0-based to 1-based
  };

  onMount(() => {
    mounted = true;
  });

  // Create the query and mutations reactively
  $: if (mounted) {
    userAnimesQuery = createQuery(
      fetchUserAnimes({ input: queryInput }),
      queryClient
    );

    // Use consolidated mutations with toast handling
    upsertAnimeMutation = useAddAnimeWithToast();
    deleteAnimeMutation = useDeleteAnimeWithToast();

    // Extend mutations with custom query invalidation for user animes
    const originalUpsertMutate = upsertAnimeMutation.mutate;
    upsertAnimeMutation.mutate = (variables, options = {}) => {
      const originalOnSuccess = options.onSuccess;
      options.onSuccess = (data, vars) => {
        // Invalidate user animes query to update the list
        queryClient.invalidateQueries({ queryKey: ['user-animes'] });
        if (originalOnSuccess) originalOnSuccess(data, vars);
      };
      return originalUpsertMutate(variables, options);
    };

    const originalDeleteMutate = deleteAnimeMutation.mutate;
    deleteAnimeMutation.mutate = (variables, options = {}) => {
      const originalOnSuccess = options.onSuccess;
      options.onSuccess = (data, vars) => {
        // Invalidate user animes query to update the list
        queryClient.invalidateQueries({ queryKey: ['user-animes'] });
        if (originalOnSuccess) originalOnSuccess(data, vars);
      };
      return originalDeleteMutate(variables, options);
    };
  }

  // Computed values
  $: userAnimes = userAnimesQuery ? ($userAnimesQuery.data?.animes || []) : [];
  $: total = userAnimesQuery ? ($userAnimesQuery.data?.total || 0) : 0;
  $: totalPages = Math.ceil(total / perPage);
  $: isLoading = userAnimesQuery ? $userAnimesQuery.isLoading : true;

  function updateURL() {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('status', selectedStatus);
      if (page > 0) {
        url.searchParams.set('page', (page + 1).toString()); // Convert to 1-based for URL
      } else {
        url.searchParams.delete('page');
      }
      window.history.pushState({}, '', url.toString());
    }
  }

  function handleStatusChange(status: Status) {
    selectedStatus = status;
    page = 0;
    updateURL();
  }

  function handlePerPageChange(e: Event) {
    const val = parseInt((e.target as HTMLSelectElement).value, 10);
    if (!isNaN(val)) {
      perPage = val;
      page = 0;
      updateURL();
    }
  }

  function handlePreviousPage() {
    page = Math.max(page - 1, 0);
    updateURL();
  }

  function handleNextPage() {
    page = Math.min(page + 1, totalPages - 1);
    updateURL();
  }

  function navigateToAnime(animeId: string) {
    navigateWithTransition(`/show/${animeId}`);
  }

  function handleDropdownStatusChange(event: CustomEvent) {
    const { animeId, status } = event.detail;
    if (upsertAnimeMutation) {
      $upsertAnimeMutation.mutate({ input: { animeID: animeId, status } });
    }
  }

  function handleDelete(event: CustomEvent) {
    const { animeId } = event.detail;
    if (deleteAnimeMutation) {
      $deleteAnimeMutation.mutate(animeId);
    }
  }

  function readStateFromURL() {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);

      // Set status from URL
      const statusParam = searchParams.get('status');
      if (statusParam && Object.values(Status).includes(statusParam as Status)) {
        selectedStatus = statusParam as Status;
      }

      // Set page from URL (convert from 1-based to 0-based)
      const pageParam = searchParams.get('page');
      if (pageParam) {
        const pageNumber = parseInt(pageParam, 10);
        if (!isNaN(pageNumber) && pageNumber > 0) {
          page = pageNumber - 1; // Convert from 1-based to 0-based
        }
      } else {
        page = 0; // Reset to first page if no page param
      }
    }
  }

  // Get URL parameters on mount to set initial status and page
  onMount(() => {
    readStateFromURL();

    // Listen for browser back/forward navigation
    const handlePopState = () => {
      readStateFromURL();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', handlePopState);

      // Cleanup on component destroy
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  });
</script>

{#if !mounted || isLoading}
  <!-- Loading skeleton -->
  <div class="pal-wrapper">
    <div class="status-tabs">
      {#each Array(5) as _}
        <div class="skeleton-tab"></div>
      {/each}
    </div>
    <div class="anime-grid" style="margin-top: 20px;">
      {#each Array(8) as _}
        <div class="skeleton-card"></div>
      {/each}
    </div>
  </div>
{:else}
  <div class="pal-wrapper">
    <!-- Status Tabs -->
    <div class="list-controls">
      <div class="status-tabs" role="tablist">
        {#each Object.values(Status) as status}
          <button
            class="tab-btn {selectedStatus === status ? 'active' : ''}"
            on:click={() => handleStatusChange(status)}
          >
            {statusLabels[status]}
            <span class="tab-count">{selectedStatus === status ? total : ''}</span>
          </button>
        {/each}
      </div>

      <div class="view-controls">
        <select class="sort-select" id="palSortSelect">
          <option value="title">Sort: Title</option>
          <option value="score">Sort: Score</option>
          <option value="updated">Sort: Last Updated</option>
        </select>
        <div class="view-toggle">
          <button
            class="view-btn"
            id="palListViewBtn"
            title="List view"
            on:click={() => {
              const listEl = document.querySelector('[data-view="list"]');
              const gridEl = document.querySelector('[data-view="grid"]');
              const listBtn = document.getElementById('palListViewBtn');
              const gridBtn = document.getElementById('palGridViewBtn');
              if (listEl) listEl.style.display = 'block';
              if (gridEl) gridEl.style.display = 'none';
              if (listBtn) listBtn.classList.add('active');
              if (gridBtn) gridBtn.classList.remove('active');
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <button
            class="view-btn active"
            id="palGridViewBtn"
            title="Grid view"
            on:click={() => {
              const listEl = document.querySelector('[data-view="list"]');
              const gridEl = document.querySelector('[data-view="grid"]');
              const listBtn = document.getElementById('palListViewBtn');
              const gridBtn = document.getElementById('palGridViewBtn');
              if (listEl) listEl.style.display = 'none';
              if (gridEl) gridEl.style.display = 'block';
              if (listBtn) listBtn.classList.remove('active');
              if (gridBtn) gridBtn.classList.add('active');
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    {#if userAnimes.length === 0}
      <!-- Empty State -->
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
            <path d="M9 10h.01M15 10h.01M9.5 15.5a3.5 3.5 0 0 0 5 0"/>
          </svg>
        </div>
        <div class="empty-title">No anime in {statusLabels[selectedStatus].toLowerCase()}</div>
        <div class="empty-text">Start building your list by browsing anime and adding them to your watchlist.</div>
        <a href="/" class="btn-browse">Browse Anime</a>
      </div>
    {:else}
      <!-- List View -->
      <div data-view="list" style="display: none;">
        <div class="anime-list">
          {#each userAnimes as entry}
            {@const title = getAnimeTitle(entry.anime, preferences.titleLanguage)}
            {@const image = GetImageFromAnime(entry.anime)}
            {@const score = entry.anime?.rating && entry.anime?.rating !== 'N/A' ? parseFloat(entry.anime.rating) : null}
            {@const episodeCount = entry.anime?.episodeCount || 0}
            {@const progress = entry.watchedEpisodes || 0}
            {@const pct = episodeCount > 0 ? (progress / episodeCount * 100) : 0}
            {@const statusColor = entry.status === Status.Watching ? 'var(--weeb-green)'
              : entry.status === Status.Completed ? 'var(--weeb-accent)'
              : entry.status === Status.Onhold ? 'var(--weeb-amber)'
              : entry.status === Status.Dropped ? 'var(--weeb-red)'
              : 'var(--weeb-fg-muted)'}
            <div
              class="anime-row"
              on:click={() => navigateToAnime(entry.anime?.id)}
              role="button"
              tabindex="0"
            >
              <div class="row-poster">
                {#if image}
                  <img src={image} alt={title} loading="lazy" />
                {:else}
                  <div class="row-poster-placeholder"></div>
                {/if}
              </div>
              <div class="row-main">
                <div class="row-title">{title}</div>
                <div class="row-sub">
                  {#if entry.anime?.type}
                    <span class="row-type-badge">{entry.anime.type}</span>
                  {/if}
                  <span style="color: {statusColor}">{statusLabels[entry.status] || ''}</span>
                </div>
              </div>
              <div class="row-score {score === null ? 'no-score' : ''}">
                {#if score !== null}
                  <span class="star">&#9733;</span> {score.toFixed(1)}
                {:else}
                  &mdash;
                {/if}
              </div>
              <div class="row-progress">
                <div class="progress-text">{progress} / {episodeCount || '?'} ep</div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: {pct}%; background: {statusColor};"></div>
                </div>
              </div>
              <div class="row-actions" on:click|stopPropagation>
                <AnimeStatusDropdown
                  entry={{ id: entry.id, anime: entry.anime, status: entry.status }}
                  variant="compact"
                  on:statusChange={handleDropdownStatusChange}
                  on:delete={handleDelete}
                />
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Grid View -->
      <div data-view="grid">
        <div class="anime-grid">
          {#each userAnimes as entry}
            <PosterCard
              id={entry.anime?.id}
              title={getAnimeTitle(entry.anime, preferences.titleLanguage)}
              image={GetImageFromAnime(entry.anime)}
              score={entry.anime?.rating && entry.anime?.rating !== 'N/A' ? parseFloat(entry.anime.rating) : null}
              status={entry.anime?.status || null}
              sub={entry.anime?.episodeCount ? `${entry.anime.episodeCount} episodes` : ''}
              genres={entry.anime?.tags || []}
              description={entry.anime?.description || ''}
              episodeCount={entry.anime?.episodeCount}
              onList={entry.status || null}
            />
          {/each}
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination">
        <div class="pagination-left">
          <button
            class="page-btn"
            on:click={handlePreviousPage}
            disabled={page === 0}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            <span class="page-btn-label">Previous</span>
          </button>

          {#if totalPages > 1}
            <span class="page-info">
              Page {page + 1} of {totalPages}
            </span>
          {/if}

          <button
            class="page-btn"
            on:click={handleNextPage}
            disabled={page + 1 >= totalPages}
          >
            <span class="page-btn-label">Next</span>
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>

        <div class="pagination-right">
          <label class="per-page-label" for="per-page-select">Show</label>
          <select id="per-page-select" class="per-page-select" on:change={handlePerPageChange}>
            {#each PAGE_SIZE_OPTIONS as opt}
              <option value={opt} selected={opt === perPage}>{opt}</option>
            {/each}
          </select>
          <span class="per-page-label">per page</span>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ── WRAPPER ──────────────────────────────────────────── */
  .pal-wrapper {
    width: 100%;
    padding: 0 var(--weeb-section-px, 48px);
  }

  /* ── SKELETON ─────────────────────────────────────────── */
  .skeleton-tab {
    height: 40px;
    width: 96px;
    background: var(--weeb-surface-hover);
    border-radius: 4px;
    animation: pulse 1.5s ease-in-out infinite;
  }
  .skeleton-card {
    background: var(--weeb-surface);
    border-radius: var(--weeb-radius-lg, 12px);
    height: 260px;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* ── STATUS TABS + CONTROLS ─────────────────────────── */
  .list-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }
  .status-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--weeb-border);
    overflow-x: auto;
    scrollbar-width: none;
    flex: 1;
    min-width: 0;
  }
  .status-tabs::-webkit-scrollbar { display: none; }

  .tab-btn {
    padding: 10px 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--weeb-fg-muted);
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s, border-color 0.15s;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tab-btn:hover { color: var(--weeb-fg); }
  .tab-btn.active {
    color: var(--weeb-accent);
    border-bottom-color: var(--weeb-accent);
  }
  .tab-count {
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
    font-family: var(--weeb-font-mono, monospace);
    background: var(--weeb-surface);
    color: var(--weeb-fg-muted);
    padding: 1px 7px;
    border-radius: 99px;
    font-weight: 600;
    min-width: 16px;
    text-align: center;
  }
  .tab-btn.active .tab-count {
    background: oklch(55% 0.15 280 / 0.15);
    color: var(--weeb-accent);
  }

  /* ── VIEW CONTROLS ──────────────────────────────────── */
  .view-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .sort-select {
    height: 34px;
    padding: 0 32px 0 12px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--weeb-fg);
    cursor: pointer;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    transition: border-color 0.15s;
  }
  .sort-select:focus { border-color: var(--weeb-accent); }
  .sort-select option { background: var(--weeb-surface); color: var(--weeb-fg); }

  .view-toggle {
    display: flex;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    overflow: hidden;
  }
  .view-btn {
    width: 34px;
    height: 34px;
    background: var(--weeb-surface);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--weeb-fg-muted);
    transition: background 0.15s, color 0.15s;
  }
  .view-btn + .view-btn { border-left: 1px solid var(--weeb-border); }
  .view-btn.active { background: oklch(55% 0.15 280 / 0.15); color: var(--weeb-accent); }
  .view-btn:hover:not(.active) { background: var(--weeb-surface-hover); }

  /* ── LIST VIEW ──────────────────────────────────────── */
  .anime-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .anime-row {
    display: grid;
    grid-template-columns: 44px 1fr 48px 140px 70px;
    align-items: center;
    gap: 14px;
    padding: 10px 16px;
    background: var(--weeb-surface);
    border: 1px solid transparent;
    border-radius: var(--weeb-radius, 8px);
    transition: border-color 0.15s, background 0.15s;
    cursor: pointer;
  }
  .anime-row:hover {
    border-color: var(--weeb-border);
    background: var(--weeb-surface-hover);
  }
  .row-poster {
    width: 36px;
    height: 52px;
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .row-poster img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
  .row-poster-placeholder {
    width: 100%;
    height: 100%;
    background: var(--weeb-surface-hover);
    border-radius: 4px;
  }
  .row-main { min-width: 0; }
  .row-title {
    font-size: 0.9rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
    color: var(--weeb-fg);
  }
  .row-sub {
    font-size: 0.75rem;
    color: var(--weeb-fg-muted);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .row-type-badge {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--weeb-surface-hover);
    color: var(--weeb-fg-secondary);
  }
  .row-score {
    font-family: var(--weeb-font-mono, monospace);
    font-size: 0.85rem;
    font-weight: 600;
    text-align: center;
    display: flex;
    align-items: center;
    gap: 3px;
    justify-content: center;
    color: var(--weeb-fg);
  }
  .row-score.no-score { color: var(--weeb-fg-muted); font-weight: 400; }
  .star { color: var(--weeb-amber); font-size: 0.7rem; }
  .row-progress { min-width: 0; }
  .progress-text {
    font-family: var(--weeb-font-mono, monospace);
    font-size: 0.7rem;
    color: var(--weeb-fg-muted);
    margin-bottom: 3px;
    white-space: nowrap;
  }
  .progress-bar {
    height: 3px;
    background: var(--weeb-surface-hover);
    border-radius: 99px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.3s ease;
  }
  .row-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    justify-content: flex-end;
  }

  /* ── GRID VIEW ──────────────────────────────────────── */
  .anime-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 16px;
    width: 100%;
  }
  .anime-grid > :global(*) {
    max-width: 200px;
  }

  /* ── EMPTY STATE ────────────────────────────────────── */
  .empty-state {
    text-align: center;
    padding: 64px 24px;
  }
  .empty-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 16px;
    border-radius: 50%;
    background: var(--weeb-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--weeb-fg-muted);
  }
  .empty-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--weeb-fg);
    margin-bottom: 8px;
  }
  .empty-text {
    font-size: 0.85rem;
    color: var(--weeb-fg-muted);
    max-width: 360px;
    margin: 0 auto 20px;
  }
  .btn-browse {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 20px;
    background: var(--weeb-accent);
    color: #fff;
    border: none;
    border-radius: var(--weeb-radius, 8px);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    text-decoration: none;
  }
  .btn-browse:hover { background: var(--weeb-accent-hover); }

  /* ── PAGINATION ─────────────────────────────────────── */
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
  .per-page-select {
    height: 32px;
    padding: 0 28px 0 10px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    color: var(--weeb-fg);
    font-size: 0.8rem;
    font-family: var(--weeb-font-mono, monospace);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%239ca3af' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    transition: border-color 0.15s;
  }
  .per-page-select:focus {
    outline: none;
    border-color: var(--weeb-accent);
  }

  /* ── RESPONSIVE ─────────────────────────────────────── */
  @media (max-width: 1024px) {
    .pal-wrapper { padding: 0 24px; }
    .anime-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
    .anime-row { grid-template-columns: 44px 1fr 48px 120px 70px; }
  }

  @media (max-width: 768px) {
    .pal-wrapper { padding: 0 16px; }
    .list-controls { flex-direction: column; align-items: stretch; }
    .view-controls { justify-content: flex-end; }
    .anime-row {
      grid-template-columns: 40px 1fr 40px 70px;
      gap: 10px;
      padding: 8px 12px;
    }
    .anime-row .row-progress { display: none; }
    .row-poster { width: 32px; height: 46px; }
    .anime-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }
    .pagination { flex-direction: column; align-items: stretch; }
    .pagination-left { justify-content: center; }
    .pagination-right { justify-content: center; }
    .page-btn-label { display: none; }
  }

  @media (max-width: 480px) {
    .anime-row {
      grid-template-columns: 1fr 40px 70px;
    }
    .anime-row .row-poster { display: none; }
    .anime-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
  }
</style>
