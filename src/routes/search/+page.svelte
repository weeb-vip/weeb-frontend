<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import { onMount } from 'svelte';
  import PosterCard from '../../svelte/components/PosterCard.svelte';
  import PosterGrid from '../../svelte/components/PosterGrid.svelte';
  import Pagination from '../../svelte/components/Pagination.svelte';
  import EmptyState from '../../svelte/components/EmptyState.svelte';
  import Select from '../../svelte/components/Select.svelte';
  import Skeleton from '../../svelte/components/Skeleton.svelte';
  import Tabs from '../../svelte/components/Tabs.svelte';
  import SafeImage from '../../svelte/components/SafeImage.svelte';
  import { GetImageFromAnime } from '../../services/utils';
  import { getStatusColor, getStatusLabel } from '../../svelte/utils/status';
  import { SearchPageBloc } from '../../svelte/components/SearchPage.bloc.svelte';

  /**
   * /search — the browse-and-search page.
   *
   * A view over the bloc. What is being searched lives in the URL, what came
   * back and how it is narrowed lives in the bloc, and this file renders it.
   */
  let { bloc = new SearchPageBloc() }: { bloc?: SearchPageBloc } = $props();

  onMount(() => {
    void bloc.init();
  });

  /**
   * The URL is the source of truth, so every navigation -- back button, a chip
   * click, a shared deep link -- comes back through here. `syncFromUrl` reads
   * the URL first, which is what subscribes this effect to it.
   */
  $effect(() => {
    bloc.syncFromUrl();
  });

  /** Grid or list. Icons only: the two shapes say it faster than the words. */
  const VIEW_MODES = [
    { value: 'grid', label: 'Grid', title: 'Grid view' },
    { value: 'list', label: 'List', title: 'List view' },
  ];
</script>

<Seo title="Browse Anime — weeb.vip" />

<div class="search-page">
  <!-- Search Hero -->
  <section class="search-hero">
    <h1>Browse Anime</h1>
    <div class="search-bar-wrap">
      <svg
        class="search-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        class="search-bar-input"
        placeholder="Search by title, studio, genre..."
        autocomplete="off"
        spellcheck="false"
        aria-label="Search anime"
        bind:value={bloc.draftQuery}
        onkeydown={(e) => {
          if (e.key === 'Enter') bloc.submit();
        }}
      />
      {#if bloc.draftQuery}
        <button class="search-bar-clear" onclick={() => bloc.clear()} aria-label="Clear search">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      {/if}
    </div>
  </section>

  <!-- Filter Bar -->
  <section class="filter-section">
    <div class="filter-row filter-row--genres">
      <span class="filter-label">Genres</span>
      {#if bloc.isLoadingGenres}
        <div class="genre-scroll">
          {#each Array(8) as _, i (i)}
            <Skeleton className="w-20 h-8 rounded-full" />
          {/each}
        </div>
      {:else if bloc.hasGenres}
        <div class="genre-scroll">
          {#each bloc.visibleGenres as genre (genre.name)}
            <button
              class="genre-tag"
              class:selected={bloc.isGenreSelected(genre.name)}
              aria-pressed={bloc.isGenreSelected(genre.name)}
              onclick={() => bloc.toggleGenre(genre.name)}
            >
              {genre.name}
              <span class="genre-tag-count">{genre.count.toLocaleString()}</span>
            </button>
          {/each}
          {#if bloc.hiddenGenreCount > 0 && !bloc.showAllGenres}
            <button class="genre-tag genre-tag--more" onclick={() => bloc.revealAllGenres()}>
              +{bloc.hiddenGenreCount} more
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <div class="filter-row filter-row--controls">
      <Select
        value={bloc.status}
        options={bloc.statusFilters}
        ariaLabel="Filter by status"
        onChange={(detail) => bloc.setStatus(detail.value)}
      />
      <Select
        value={bloc.year}
        options={bloc.yearSelectOptions}
        ariaLabel="Filter by year"
        onChange={(detail) => bloc.setYear(detail.value)}
      />
      <Select
        value={bloc.sort}
        options={bloc.sortOptions}
        ariaLabel="Sort results"
        onChange={(detail) => bloc.setSort(detail.value)}
      />
    </div>
  </section>

  <!-- Active Filters -->
  {#if bloc.hasActiveFilters}
    <section class="active-filters-section">
      <div class="active-filters">
        <span class="active-filters-label">Active filters:</span>
        {#each bloc.activeFilters as filter (filter.key)}
          <button class="filter-pill" onclick={filter.remove}>
            {filter.label}
            <span class="filter-pill-remove">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </span>
          </button>
        {/each}
        <button class="clear-all-btn" onclick={() => bloc.clear()}>Clear all</button>
      </div>
    </section>
  {/if}

  <!-- Results Header -->
  {#if bloc.hasSearched}
    <div class="results-header">
      <p class="results-count">{bloc.resultsSummary}</p>
      <Tabs
        variant="segmented"
        mode="toggle"
        iconOnly
        items={VIEW_MODES}
        value={bloc.viewMode}
        onChange={(mode) => bloc.setViewMode(mode)}
        ariaLabel="View mode"
      >
        {#snippet itemContent(item)}
          {#if item.value === 'grid'}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
          {:else}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          {/if}
        {/snippet}
      </Tabs>
    </div>
  {/if}

  <!-- Results -->
  {#if bloc.phase === 'loading'}
    <PosterGrid class="results-grid">
      {#each Array(12) as _, i (i)}
        <div>
          <Skeleton className="w-full aspect-[2/3] rounded-lg" />
          <Skeleton className="w-4/5 h-3.5 mt-2.5" />
          <Skeleton className="w-1/2 h-3 mt-1.5" />
        </div>
      {/each}
    </PosterGrid>
  {:else if bloc.phase === 'empty'}
    <EmptyState
      class="empty-state"
      heading="No results found"
      message="Try adjusting your filters or search term."
      action={{ label: 'Clear all filters', onClick: () => bloc.clear(), variant: 'ghost' }}
    />
  {:else if bloc.phase === 'results'}
    {#if bloc.viewMode === 'grid'}
      <PosterGrid class="results-grid">
        {#each bloc.results as item (item.objectID)}
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
            onList={bloc.listStatusFor(item)}
          />
        {/each}
      </PosterGrid>
    {:else}
      <div class="results-list">
        {#each bloc.results as item (item.objectID)}
          <a class="list-item" href={bloc.hrefFor(item)}>
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
                <div class="list-desc">{bloc.excerpt(item.description)}</div>
              {/if}
              {#if item.tags?.length > 0}
                <div class="list-tags">
                  {#each item.tags.slice(0, 4) as tag (tag)}
                    <span class="list-tag">{tag}</span>
                  {/each}
                </div>
              {/if}
            </div>
            <div class="list-badges">
              {#if bloc.listStatusFor(item)}
                <!-- One badge rule, coloured from the shared status map, rather
                     than five near-identical class variants that had drifted
                     from the ones the cards use. -->
                <span
                  class="list-status-badge"
                  style="--badge-color: {getStatusColor(bloc.listStatusFor(item))}"
                >
                  {getStatusLabel(bloc.listStatusFor(item))}
                </span>
              {/if}
              {#if item.ratingNum}
                <div class="list-score">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
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
    {#if bloc.works.length > 0}
      <section class="works-section" aria-labelledby="works-heading">
        <h2 class="works-heading" id="works-heading">Manga &amp; light novels</h2>
        {#if bloc.viewMode === 'grid'}
          <PosterGrid class="results-grid">
            {#each bloc.works as work (work.objectID)}
              <PosterCard
                id={work.id || ''}
                title={work.title_en || work.title_jp || ''}
                image={work.id || ''}
                imagePath="works"
                score={work.score}
                sub={bloc.workSubtitle(work)}
                description={work.description || ''}
                href={bloc.workHref(work)}
              />
            {/each}
          </PosterGrid>
        {:else}
          <!-- The same list rows the anime results use, so switching view mode
               changes the whole page rather than half of it. -->
          <div class="results-list">
            {#each bloc.works as work (work.objectID)}
              <a class="list-item" href={bloc.workHref(work)}>
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
                    {bloc.workSubtitle(work)}
                    {#if work.volumes} · {work.volumes} volumes{/if}
                    {#if work.chapters} · {work.chapters} chapters{/if}
                  </div>
                  {#if work.description}
                    <div class="list-desc">{bloc.excerpt(work.description)}</div>
                  {/if}
                  {#if work.authors?.length > 0}
                    <div class="list-tags">
                      {#each work.authors.slice(0, 3) as author (author)}
                        <span class="list-tag">{author}</span>
                      {/each}
                    </div>
                  {/if}
                </div>
                <div class="list-badges">
                  {#if work.score}
                    <div class="list-score">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
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

    {#if bloc.totalPages > 1}
      <Pagination
        page={bloc.page}
        totalPages={bloc.totalPages}
        perPage={bloc.perPage}
        perPageOptions={bloc.pageSizeOptions}
        onPageChange={(next) => bloc.goToPage(next)}
        onPerPageChange={(next) => bloc.setPerPage(next)}
        label="Search results pagination"
      />
    {/if}
  {:else}
    <!-- Nothing searched yet: the browse placeholder. -->
    <EmptyState
      class="empty-state"
      size="hero"
      heading="Browse anime"
      message="Search by title or click a genre above to explore."
    />
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
    padding: 0 56px;
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
  .search-bar-input::placeholder {
    color: var(--weeb-fg-muted);
  }
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
  .filter-section {
    padding: 16px 0 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
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

  /* Active Filters */
  .active-filters-section {
    padding: 12px 0;
  }
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
  .filter-pill:hover {
    background: color-mix(in oklch, var(--weeb-accent) 18%, transparent);
  }
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
  .clear-all-btn:hover {
    color: var(--weeb-fg);
  }

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

  /* ── Works section ──
     Set apart from the anime grid rather than blended into it: the two indices
     rank independently, so presenting them as one list would imply an order
     that does not exist. */
  .works-section {
    margin-top: 40px;
    padding-top: 28px;
    border-top: 1px solid var(--weeb-border);
  }
  .works-heading {
    margin: 0 0 16px;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--weeb-fg-muted);
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
  .list-item:hover {
    background: var(--weeb-surface);
    margin: 0 -16px;
    padding: 16px;
  }
  .list-item:hover .list-title {
    color: var(--weeb-accent-text);
  }
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
    color: var(--badge-color, var(--weeb-fg-secondary));
    border: 1px solid var(--badge-color, var(--weeb-border));
    background: color-mix(in oklch, var(--badge-color, var(--weeb-surface)) 8%, transparent);
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
  }

  /* Responsive */
  @media (max-width: 768px) {
    .search-page {
      padding: 0 16px;
    }
    .search-hero {
      padding: 32px 0 24px;
    }
    .filter-row {
      gap: 6px;
    }
    .filter-row--controls {
      flex-wrap: wrap;
    }
  }
  @media (max-width: 480px) {
    .search-page {
      padding: 0 12px;
    }
    .search-hero {
      padding: 24px 0 16px;
    }
    .search-bar-input {
      height: 48px;
      font-size: 14px;
      border-radius: 24px;
      padding: 0 48px;
    }
    .search-icon {
      left: 18px;
    }
    .search-bar-clear {
      right: 14px;
    }
    .list-desc {
      display: none;
    }
    .list-poster {
      width: 44px;
      height: 66px;
    }
  }
</style>
