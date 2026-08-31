<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount, tick } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { derived } from 'svelte/store';
  import { fetchUserWorks, fetchUserWorkStatusCounts } from '../../services/queries';
  import { WorkStatus } from '../../gql/graphql';
  import { workSubtitle } from '../../utils/workDisplay';
  import { initializeQueryClient } from '../services/query-client';
  import PosterCard from './PosterCard.svelte';
  import PosterGrid from './PosterGrid.svelte';
  import SafeImage from './SafeImage.svelte';
  import WorkStatusControl from './WorkStatusControl.svelte';

  /*
    The reading list. Deliberately the same shape as ProfileAnimeList -- tabs,
    grid and list views, pagination -- because a reader switching between the two
    should find the same controls in the same places. What differs is the medium:
    progress is chapters rather than episodes, and the card links to /manga.

    The work behind each entry arrives through federation (UserWork.work), so a
    row has its title, cover and slug without a second request.
  */

  const queryClient = initializeQueryClient();

  const PAGE_SIZE_OPTIONS = [24, 48, 72, 100];

  function getDefaultPageSize(): number {
    if (typeof window === 'undefined') return 48;
    const w = window.innerWidth;
    if (w >= 1920) return 72;
    if (w >= 1440) return 48;
    return 24;
  }

  let mounted = false;
  // Reading is the default because it is the shelf a reader checks most -- what
  // they are in the middle of -- where the anime list opens on Plan to Watch.
  const STATUSES = Object.values(WorkStatus);
  let selectedStatus: WorkStatus = WorkStatus.Reading;
  let page = 0;
  let perPage = getDefaultPageSize();

  const statusLabels: Record<WorkStatus, string> = {
    [WorkStatus.Completed]: 'Completed',
    [WorkStatus.Dropped]: 'Dropped',
    [WorkStatus.Onhold]: 'On Hold',
    [WorkStatus.Plantoread]: 'Plan to Read',
    [WorkStatus.Reading]: 'Reading',
  };

  let userWorksQuery: any;
  // A count per status, so every tab carries its size, not only the active
  // one. Created once and independent of the visible tab.
  let countsStore: any;
  let counts: Record<string, number> = {};

  $: queryInput = {
    status: selectedStatus,
    limit: perPage,
    page: page + 1, // list-service pages are 1-based
  };

  onMount(() => {
    mounted = true;
  });

  $: if (mounted && !countsStore) {
    const q = createQuery(fetchUserWorkStatusCounts(), queryClient);
    countsStore = derived(q, ($q) => {
      const d = ($q as any)?.data;
      return {
        [WorkStatus.Reading]: Number(d?.reading ?? 0),
        [WorkStatus.Plantoread]: Number(d?.planToRead ?? 0),
        [WorkStatus.Completed]: Number(d?.completed ?? 0),
        [WorkStatus.Onhold]: Number(d?.onHold ?? 0),
        [WorkStatus.Dropped]: Number(d?.dropped ?? 0),
      } as Record<string, number>;
    });
  }
  $: counts = countsStore ? $countsStore : {};

  $: if (mounted) {
    userWorksQuery = createQuery(fetchUserWorks({ input: queryInput }), queryClient);
  }

  $: userWorks = userWorksQuery ? ($userWorksQuery.data?.works ?? []) : [];
  $: total = userWorksQuery ? ($userWorksQuery.data?.total ?? 0) : 0;
  $: totalPages = Math.ceil(total / perPage);
  $: isLoading = userWorksQuery ? $userWorksQuery.isLoading : true;
  // First time the real tab bar is mounted (skeleton gone), bring the active
  // tab into view -- on mount it does not exist yet.
  $: if (mounted && !isLoading && !scrolledInitial) {
    scrolledInitial = true;
    scrollActiveTabIntoView();
  }

  // Status and page live in the URL, so a shared or reloaded link lands on the
  // same shelf. The medium is owned by the wrapper above, under ?medium.
  function updateURL() {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('status', selectedStatus);
    if (page > 0) url.searchParams.set('page', String(page + 1));
    else url.searchParams.delete('page');
    window.history.pushState({}, '', url.toString());
  }

  let tabsEl: HTMLElement;
  let scrolledInitial = false;

  // Keep the selected tab on screen: the row scrolls horizontally on narrow
  // viewports, and the active tab is the one that must not fall off the edge.
  async function scrollActiveTabIntoView() {
    await tick();
    const active = tabsEl?.querySelector<HTMLElement>('.tab-btn.active');
    if (!active || !tabsEl) return;
    const c = tabsEl.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    tabsEl.scrollTo({
      left: tabsEl.scrollLeft + (a.left - c.left) - (c.width - a.width) / 2,
      behavior: 'smooth',
    });
  }

  function handleStatusChange(status: WorkStatus) {
    selectedStatus = status;
    page = 0;
    updateURL();
    scrollActiveTabIntoView();
  }

  function handlePerPageChange(e: Event) {
    const val = parseInt((e.target as HTMLSelectElement).value, 10);
    if (!Number.isNaN(val)) {
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

  function workHref(work: any): string {
    return work?.urlSlug ? `/manga/${work.urlSlug}` : '/search';
  }

  function navigateToWork(work: any) {
    if (work?.urlSlug) goto(`/manga/${work.urlSlug}`);
  }

  function readStateFromURL() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    const statusParam = params.get('status');
    if (statusParam && Object.values(WorkStatus).includes(statusParam as WorkStatus)) {
      selectedStatus = statusParam as WorkStatus;
    }

    const pageParam = params.get('page');
    if (pageParam) {
      const n = parseInt(pageParam, 10);
      page = !Number.isNaN(n) && n > 0 ? n - 1 : 0;
    } else {
      page = 0;
    }
  }

  onMount(() => {
    readStateFromURL();
    const onPop = () => readStateFromURL();
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    }
  });

  const statusColorFor = (status: WorkStatus | null | undefined) =>
    status === WorkStatus.Reading ? 'var(--weeb-green)'
    : status === WorkStatus.Completed ? 'var(--weeb-accent)'
    : status === WorkStatus.Onhold ? 'var(--weeb-amber)'
    : status === WorkStatus.Dropped ? 'var(--weeb-red)'
    : 'var(--weeb-fg-muted)';
</script>

{#if !mounted || isLoading}
  <div class="pal-wrapper">
    <div class="status-tabs">
      {#each Array(5) as _}
        <div class="skeleton-tab"></div>
      {/each}
    </div>
    <PosterGrid class="pal-grid">
      {#each Array(8) as _}
        <div class="skeleton-card"></div>
      {/each}
    </PosterGrid>
  </div>
{:else}
  <div class="pal-wrapper">
    <div class="list-controls">
      <div class="status-tabs" role="tablist" bind:this={tabsEl}>
        {#each STATUSES as status}
          <button
            class="tab-btn {selectedStatus === status ? 'active' : ''}"
            role="tab"
            aria-selected={selectedStatus === status}
            on:click={() => handleStatusChange(status)}
          >
            {statusLabels[status]}
            <span class="tab-count" class:is-zero={(counts[status] ?? 0) === 0}>{counts[status] ?? 0}</span>
          </button>
        {/each}
      </div>

      <div class="view-controls">
        <div class="view-toggle">
          <button
            class="view-btn"
            id="pwlListViewBtn"
            title="List view"
            on:click={() => {
              const listEl = document.querySelector('[data-work-view="list"]');
              const gridEl = document.querySelector('[data-work-view="grid"]');
              const listBtn = document.getElementById('pwlListViewBtn');
              const gridBtn = document.getElementById('pwlGridViewBtn');
              if (listEl) (listEl as HTMLElement).style.display = 'block';
              if (gridEl) (gridEl as HTMLElement).style.display = 'none';
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
            id="pwlGridViewBtn"
            title="Grid view"
            on:click={() => {
              const listEl = document.querySelector('[data-work-view="list"]');
              const gridEl = document.querySelector('[data-work-view="grid"]');
              const listBtn = document.getElementById('pwlListViewBtn');
              const gridBtn = document.getElementById('pwlGridViewBtn');
              if (listEl) (listEl as HTMLElement).style.display = 'none';
              if (gridEl) (gridEl as HTMLElement).style.display = 'block';
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

    {#if userWorks.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </div>
        <div class="empty-title">No manga in {statusLabels[selectedStatus].toLowerCase()}</div>
        <div class="empty-text">Start building your reading list by browsing manga and adding them to your shelf.</div>
        <a href="/search" class="btn-browse">Browse Manga</a>
      </div>
    {:else}
      <!-- List View -->
      <div data-work-view="list" style="display: none;">
        <div class="work-list">
          {#each userWorks as entry (entry.id)}
            {@const work = entry.work}
            {@const title = work?.titleEn || work?.titleJp || 'Untitled'}
            {@const total_ch = work?.chapters ?? 0}
            {@const read = entry.chapters ?? 0}
            {@const pct = total_ch > 0 ? (read / total_ch) * 100 : 0}
            {@const statusColor = statusColorFor(entry.status)}
            <div
              class="work-row"
              on:click={() => navigateToWork(work)}
              on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToWork(work); } }}
              role="button"
              tabindex="0"
            >
              <div class="row-poster">
                {#if work?.id}
                  <SafeImage src={work.id} path="works" alt={title} className="row-poster-img" />
                {:else}
                  <div class="row-poster-placeholder"></div>
                {/if}
              </div>
              <div class="row-main">
                <div class="row-title">{title}</div>
                <div class="row-sub">
                  <span class="row-type-badge">{workSubtitle(work?.type, work?.publishedFrom)}</span>
                  <span style="color: {statusColor}">{statusLabels[entry.status] || ''}</span>
                </div>
              </div>
              <div class="row-score {work?.score == null ? 'no-score' : ''}">
                {#if work?.score != null}
                  <span class="star">&#9733;</span> {work.score.toFixed(1)}
                {:else}
                  &mdash;
                {/if}
              </div>
              <div class="row-progress">
                <div class="progress-text">{read} / {total_ch || '?'} ch</div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: {pct}%; background: {statusColor};"></div>
                </div>
              </div>
              <div class="row-actions" role="presentation" on:click|stopPropagation on:keydown|stopPropagation>
                <WorkStatusControl workId={entry.workID} userWork={{ id: entry.id, status: entry.status }} />
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Grid View -->
      <div data-work-view="grid">
        <PosterGrid>
          {#each userWorks as entry (entry.id)}
            {@const work = entry.work}
            <PosterCard
              id={work?.id ?? ''}
              title={work?.titleEn || work?.titleJp || 'Untitled'}
              image={work?.id ?? ''}
              imagePath="works"
              score={work?.score ?? null}
              sub={workSubtitle(work?.type, work?.publishedFrom)}
              href={workHref(work)}
              onList={entry.status || null}
            />
          {/each}
        </PosterGrid>
      </div>

      <!-- Pagination -->
      <div class="pagination">
        <div class="pagination-left">
          <button class="page-btn" on:click={handlePreviousPage} disabled={page === 0}>
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            <span class="page-btn-label">Previous</span>
          </button>

          {#if totalPages > 1}
            <span class="page-info">Page {page + 1} of {totalPages}</span>
          {/if}

          <button class="page-btn" on:click={handleNextPage} disabled={page + 1 >= totalPages}>
            <span class="page-btn-label">Next</span>
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>

        <div class="pagination-right">
          <label class="per-page-label" for="pwl-per-page">Show</label>
          <select id="pwl-per-page" class="per-page-select" on:change={handlePerPageChange}>
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
    color: var(--weeb-accent-text);
    border-bottom-color: var(--weeb-accent);
  }
  .tab-count {
    font-size: 0.68rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    font-family: var(--weeb-font-mono, monospace);
    background: var(--weeb-surface-hover);
    color: var(--weeb-fg-secondary);
    padding: 2px 6px;
    border-radius: 6px;
    font-weight: 600;
    min-width: 18px;
    text-align: center;
    transition: background 0.15s, color 0.15s, opacity 0.15s;
  }
  /* An empty status recedes, so the tabs a viewer actually has content in are
     what the eye lands on when scanning the row. */
  /* Muted colour and no pill carry the de-emphasis; the numeral stays legible
     rather than fading below contrast. */
  .tab-count.is-zero {
    background: transparent;
    color: var(--weeb-fg-muted);
  }
  .tab-btn.active .tab-count {
    background: color-mix(in oklch, var(--weeb-accent) 18%, transparent);
    color: var(--weeb-accent-text);
    opacity: 1;
  }

  /* ── VIEW CONTROLS ──────────────────────────────────── */
  .view-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
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
  .view-btn.active { background: color-mix(in oklch, var(--weeb-accent) 15%, transparent); color: var(--weeb-accent-text); }
  .view-btn:hover:not(.active) { background: var(--weeb-surface-hover); }

  /* ── LIST VIEW ──────────────────────────────────────── */
  .work-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .work-row {
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
  .work-row:hover {
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
  /* SafeImage wraps its <img> in a relative div and styles the image itself;
     this only has to make that wrapper fill the fixed-size poster box, or it
     collapses and the cover disappears. */
  .row-poster :global(.relative) { width: 100%; height: 100%; }
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
    .work-row { grid-template-columns: 44px 1fr 48px 120px 70px; }
  }

  @media (max-width: 768px) {
    .pal-wrapper { padding: 0 16px; }
    .list-controls { flex-direction: column; align-items: stretch; }
    .view-controls { justify-content: flex-end; }
    .work-row {
      grid-template-columns: 40px 1fr 40px 70px;
      gap: 10px;
      padding: 8px 12px;
    }
    .work-row .row-progress { display: none; }
    .row-poster { width: 32px; height: 46px; }
    .pagination { flex-direction: column; align-items: stretch; }
    .pagination-left { justify-content: center; }
    .pagination-right { justify-content: center; }
    .page-btn-label { display: none; }
  }

  @media (max-width: 480px) {
    .work-row {
      grid-template-columns: 1fr 40px 70px;
    }
    .work-row .row-poster { display: none; }
  }
  /* Was an inline margin-top on the grid div. */
  :global(.pal-grid) { margin-top: 20px; }
</style>
