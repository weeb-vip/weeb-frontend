<script lang="ts">
  import type { Snippet } from 'svelte';
  import { goto } from '$app/navigation';
  import EmptyState from './EmptyState.svelte';
  import ErrorBanner from './ErrorBanner.svelte';
  import Pagination from './Pagination.svelte';
  import PosterCard from './PosterCard.svelte';
  import PosterGrid from './PosterGrid.svelte';
  import SafeImage from './SafeImage.svelte';
  import Skeleton from './Skeleton.svelte';
  import AnimeCardSkeleton from './AnimeCardSkeleton.svelte';
  import Tabs, { type TabItem } from './Tabs.svelte';
  import type { MediaListBloc, MediaListRow } from './MediaList.bloc.svelte';

  /**
   * The shelf: status tabs with counts, a grid/table switch, the entries, and
   * the pager under them.
   *
   * One implementation for both media. ProfileAnimeList and ProfileWorkList are
   * the two entry points; what differs between them arrives in the bloc's
   * medium config, plus the two snippets below -- the row's own tracking control
   * and the empty state's icon, which are the only markup a medium owns.
   */
  let {
    bloc,
    rowActions,
    emptyIcon,
  }: {
    bloc: MediaListBloc;
    /** The medium's tracking control, rendered at the end of each row. */
    rowActions?: Snippet<[MediaListRow]>;
    emptyIcon?: Snippet;
  } = $props();

  let tabsEl = $state<HTMLElement | undefined>();

  // Adopt the address on mount and follow back/forward from there. The bloc
  // returns its own teardown.
  $effect(() => bloc.start());

  /**
   * Keep the selected tab on screen. The row scrolls horizontally on narrow
   * viewports, and without this the active tab -- the one tab a viewer most
   * needs to see -- can sit past the edge.
   */
  function scrollActiveTabIntoView(): void {
    const container = tabsEl?.querySelector<HTMLElement>('[role="tablist"]');
    const active = container?.querySelector<HTMLElement>('.tab.active');
    if (!container || !active) return;
    const c = container.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    container.scrollTo({
      left: container.scrollLeft + (a.left - c.left) - (c.width - a.width) / 2,
      behavior: 'smooth',
    });
  }

  // Runs on the first real tab bar (the skeleton has none) and after every tab
  // change, which is exactly when the active tab can be off screen.
  $effect(() => {
    bloc.status;
    if (bloc.isLoading) return;
    scrollActiveTabIntoView();
  });

  function openRow(row: MediaListRow): void {
    if (row.href) goto(row.href);
  }
</script>

<div class="pml">
  {#if bloc.isLoading}
    <!-- The same shape as the loaded list: a tab row, then a wall of cards. -->
    <div class="pml-tab-skeleton">
      {#each Array(5) as _}
        <Skeleton className="h-10 w-24" />
      {/each}
    </div>
    <PosterGrid class="pml-grid">
      {#each Array(8) as _}
        <AnimeCardSkeleton />
      {/each}
    </PosterGrid>
  {:else}
    <div class="pml-controls">
      <div class="pml-tabs" bind:this={tabsEl}>
        <Tabs
          items={bloc.tabs}
          value={bloc.status}
          onChange={(value) => bloc.selectStatus(value)}
          variant="underline"
          ariaLabel={bloc.config.tabsLabel}
        />
      </div>

      <Tabs
        items={[
          { value: 'list', label: 'List', title: 'List view' },
          { value: 'grid', label: 'Grid', title: 'Grid view' },
        ]}
        value={bloc.view}
        onChange={(value) => bloc.setView(value === 'list' ? 'list' : 'grid')}
        variant="segmented"
        mode="toggle"
        iconOnly
        ariaLabel="Grid or list"
        itemContent={viewIcon}
      />
    </div>

    {#if bloc.isError}
      <!-- A failed fetch is not an empty shelf: this says what happened and
           offers the retry rather than claiming there is nothing on the list. -->
      <ErrorBanner
        message={bloc.config.errorMessage}
        detail={bloc.errorDetail}
        retrying={bloc.isRetrying}
        onRetry={() => bloc.retry()}
      />
    {:else if bloc.isEmpty}
      <EmptyState
        icon={emptyIcon}
        iconFrame="circle"
        heading={bloc.config.empty.heading(bloc.statusLabel)}
        message={bloc.config.empty.message}
        action={{ label: bloc.config.empty.actionLabel, href: bloc.config.empty.actionHref }}
      />
    {:else if bloc.view === 'list'}
      <div class="pml-rows" class:is-busy={bloc.isMutating}>
        {#each bloc.rows as row (row.key)}
          {@const color = bloc.statusColor(row.status)}
          {@const pct = row.progress.total ? (row.progress.current / row.progress.total) * 100 : 0}
          <div
            class="row"
            role="button"
            tabindex="0"
            onclick={() => openRow(row)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openRow(row);
              }
            }}
          >
            <div class="row-poster">
              {#if row.image}
                <SafeImage src={row.image} path={row.imagePath} alt={row.title} className="row-poster-img" />
              {:else}
                <div class="row-poster-placeholder"></div>
              {/if}
            </div>

            <div class="row-main">
              <div class="row-title">{row.title}</div>
              <div class="row-sub">
                {#if row.typeBadge}
                  <span class="row-type-badge">{row.typeBadge}</span>
                {/if}
                <span style="color: {color}">{bloc.config.statusLabel(row.status)}</span>
              </div>
            </div>

            <div class="row-score" class:no-score={row.score == null}>
              {#if row.score != null}
                <span class="star">&#9733;</span> {row.score.toFixed(1)}
              {:else}
                &mdash;
              {/if}
            </div>

            <div class="row-progress">
              <div class="progress-text">
                {row.progress.current} / {row.progress.total || '?'} {row.progress.unit}
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: {pct}%; background: {color};"></div>
              </div>
            </div>

            <!-- Presentational wrapper: it only stops the row's own navigation
                 from firing while the control inside is being used. -->
            <div
              class="row-actions"
              role="presentation"
              onclick={(e) => e.stopPropagation()}
              onkeydown={(e) => e.stopPropagation()}
            >
              {@render rowActions?.(row)}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <PosterGrid class="pml-grid" loading={bloc.isMutating}>
        {#each bloc.rows as row (row.key)}
          <PosterCard {...row.card} />
        {/each}
      </PosterGrid>
    {/if}

    {#if !bloc.isError && !bloc.isEmpty}
      <Pagination
        page={bloc.page}
        totalPages={bloc.totalPages}
        perPage={bloc.perPage}
        perPageOptions={bloc.perPageOptions}
        onPageChange={(next) => bloc.goToPage(next)}
        onPerPageChange={(next) => bloc.setPerPage(next)}
        label="List pages"
      />
    {/if}
  {/if}
</div>

{#snippet viewIcon(item: TabItem)}
  {#if item.value === 'list'}
    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  {:else}
    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  {/if}
{/snippet}

<style>
  .pml {
    width: 100%;
    padding: 0 var(--weeb-section-px, 48px);
  }

  .pml-tab-skeleton {
    display: flex;
    gap: 8px;
    border-bottom: 1px solid var(--weeb-border);
    padding-bottom: 4px;
    overflow: hidden;
  }

  /* ── TABS + VIEW SWITCH ─────────────────────────────── */
  .pml-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }
  /* The tab strip takes the room; the switch keeps its size. */
  .pml-tabs {
    flex: 1;
    min-width: 0;
  }

  /* ── LIST VIEW ──────────────────────────────────────── */
  .pml-rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: opacity 0.2s ease;
  }
  .pml-rows.is-busy {
    opacity: 0.6;
    pointer-events: none;
  }
  .row {
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
  .row:hover {
    border-color: var(--weeb-border);
    background: var(--weeb-surface-hover);
  }
  .row:focus-visible {
    outline: 2px solid var(--weeb-accent);
    outline-offset: -2px;
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
    min-width: 0;
  }
  .row-type-badge {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--weeb-surface-hover);
    color: var(--weeb-fg-secondary);
    white-space: nowrap;
  }

  .row-score {
    font-family: var(--weeb-font-mono, monospace);
    font-size: 0.85rem;
    font-weight: 600;
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

  /* ── RESPONSIVE ─────────────────────────────────────── */
  @media (max-width: 1024px) {
    .pml { padding: 0 24px; }
    .row { grid-template-columns: 44px 1fr 48px 120px 70px; }
  }

  @media (max-width: 768px) {
    .pml { padding: 0 16px; }
    .pml-controls { flex-direction: column; align-items: stretch; }
    .row {
      grid-template-columns: 40px 1fr 40px 70px;
      gap: 10px;
      padding: 8px 12px;
    }
    .row .row-progress { display: none; }
    .row-poster { width: 32px; height: 46px; }
  }

  @media (max-width: 480px) {
    .row { grid-template-columns: 1fr 40px 70px; }
    .row .row-poster { display: none; }
  }

  /* Was an inline margin-top on the grid div. */
  :global(.pml-grid) { margin-top: 20px; }
</style>
