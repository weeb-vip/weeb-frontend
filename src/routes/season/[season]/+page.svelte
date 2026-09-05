<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { itemListSchema, breadcrumbSchema } from '$lib/structured-data';
  import { fly } from 'svelte/transition';
  import PosterCard from '../../../svelte/components/PosterCard.svelte';
  import PosterGrid from '../../../svelte/components/PosterGrid.svelte';
  import PosterCardSkeleton from '../../../svelte/components/PosterCardSkeleton.svelte';
  import EmptyState from '../../../svelte/components/EmptyState.svelte';
  import SafeImage from '../../../svelte/components/SafeImage.svelte';
  import { SeasonPageBloc, type SeasonalAnime } from '../../../svelte/components/SeasonPage.bloc.svelte';

  /**
   * Everything that aired in one season, with a tag filter over it.
   *
   * A view over the bloc: it owns the query, the ordering, the tag facets and
   * the filter; this renders them.
   */
  let {
    data,
    bloc: injected = undefined,
  }: {
    data: {
      season: string;
      displayName: string;
      seasonalData?: { animeBySeasons?: SeasonalAnime[] | null } | null;
      ssrError?: string | null;
    };
    bloc?: SeasonPageBloc;
  } = $props();

  /**
   * The season is the key.
   *
   * This used to be `{#key data.season}<SeasonPage … />`: stepping to the next
   * season replaced the component, which meant a fresh bloc -- an unfiltered
   * tag list, and the new season's loader payload seeded into the query cache
   * by the constructor. SvelteKit reuses one `+page.svelte` across a param
   * change, so now that the page *is* the route the key has to be explicit.
   * A new season rebuilds the bloc here, and the markup below is keyed on the
   * same value so the grid remounts with it.
   */
  const season = $derived(data.season);

  const bloc = $derived.by(() => {
    const forSeason = season;
    return (
      injected ??
      new SeasonPageBloc({
        source: () => ({
          season: forSeason,
          seasonalData: data.seasonalData ?? null,
          ssrError: data.ssrError ?? null,
        }),
      })
    );
  });

  $effect(() => bloc.init());

  const SITE_URL = 'https://weeb.vip';

  const canonical = $derived(`${SITE_URL}/season/${data.season}`);
  const schemas = $derived([
    itemListSchema(data.seasonalData?.animeBySeasons, {
      name: `${data.displayName} Anime`,
      url: canonical,
      siteUrl: SITE_URL
    }),
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: `${data.displayName} Anime`, url: canonical }
    ])
  ]);
</script>

<Seo
  title={`${data.displayName} Anime`}
  description={`Browse all anime from the ${data.displayName} season. Discover new shows, check ratings, and add them to your watchlist.`}
/>

<StructuredData {schemas} />

{#snippet sadFace()}
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/><path d="M9 10h.01M15 10h.01M9.5 15.5a3.5 3.5 0 0 1 5 0"/></svg>
{/snippet}

{#snippet brokenCircle()}
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
{/snippet}

{#key season}
<div class="season-page">
  <header class="page-header">
    <p class="page-eyebrow">Seasonal Anime</p>
    <h1 class="page-title">
      <span class="accent">{bloc.seasonName}</span> {bloc.year}
    </h1>
  </header>

  <div class="season-selector">
    <div class="season-tabs" role="tablist">
      {#each bloc.seasonTabs as tab (tab.season)}
        <button
          type="button"
          class="season-tab"
          class:active={tab.active}
          role="tab"
          aria-selected={tab.active}
          onclick={() => bloc.goToSeason(tab.key)}
        >
          <span class="season-tab-icon" aria-hidden="true">{tab.icon}</span>
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="season-nav">
      <button
        type="button"
        class="season-arrow"
        aria-label="Previous season"
        onclick={() => bloc.goToSeason(bloc.previousSeason)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>

      <div class="year-selector">
        {#each bloc.yearOptions as option (option.year)}
          <button
            type="button"
            class="year-tab"
            class:active={option.active}
            onclick={() => bloc.goToSeason(option.key)}
          >
            {option.year}
          </button>
        {/each}
      </div>

      <button
        type="button"
        class="season-arrow"
        aria-label="Next season"
        onclick={() => bloc.goToSeason(bloc.nextSeason)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
  </div>

  <div class="season-stats">
    <span class="stats-label">{bloc.statsLabel}</span>

    {#if !bloc.isCurrentSeason}
      <span class="stats-divider"></span>
      <button
        type="button"
        class="current-season-link"
        onclick={() => bloc.goToSeason(bloc.currentSeason)}
      >
        Jump to current season
      </button>
    {/if}
  </div>

  {#if bloc.topOfSeason.length > 0}
    <div class="top-strip">
      <span class="top-strip-label">TOP THIS SEASON</span>
      <div class="top-strip-items">
        {#each bloc.topOfSeason as anime, index (anime.id)}
          <a href={bloc.hrefFor(anime)} class="top-strip-card">
            <span class="top-strip-rank">#{index + 1}</span>
            <div class="top-strip-poster">
              <SafeImage
                src={bloc.imageFor(anime)}
                alt={bloc.titleFor(anime)}
                className="w-full h-full object-cover"
              />
            </div>
            <div class="top-strip-info">
              <span class="top-strip-title">{bloc.titleFor(anime)}</span>
              <span class="top-strip-meta">{bloc.stripMetaFor(anime)}</span>
            </div>
          </a>
        {/each}
      </div>
    </div>
  {/if}

  <div class="filter-bar">
    <h2 class="filter-title">All Shows</h2>
    <div class="filter-pills">
      <span class="filter-count">{bloc.countLabel} titles</span>
    </div>
  </div>

  {#if bloc.allTags.length > 0}
    <div class="tag-filter">
      <div class="tag-filter-row">
        {#if bloc.hasTagFilter}
          <button type="button" class="tag-pill tag-pill--clear" onclick={() => bloc.clearTags()}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            Clear
          </button>
        {/if}
        {#each bloc.visibleTags as facet (facet.tag)}
          <button
            type="button"
            class="tag-pill"
            class:active={bloc.isTagSelected(facet.tag)}
            aria-pressed={bloc.isTagSelected(facet.tag)}
            onclick={() => bloc.toggleTag(facet.tag)}
          >
            {facet.tag}
            <span class="tag-count">{facet.count}</span>
          </button>
        {/each}
        {#if bloc.hasHiddenTags}
          <button
            type="button"
            class="tag-pill tag-pill--toggle"
            onclick={() => bloc.toggleShowAllTags()}
          >
            {bloc.showAllTags ? 'Show less' : `+${bloc.hiddenTagCount} more`}
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <PosterGrid minHeight="400px" loading={bloc.isRefreshing}>
    {#if bloc.isLoading}
      {#each Array(16) as _, index (index)}
        <PosterCardSkeleton />
      {/each}
    {:else if bloc.isError && bloc.filtered.length === 0}
      <!-- The fetch failed, so this page has nothing to say about the season --
           which is not the same claim as "this season is empty". -->
      <EmptyState
        icon={brokenCircle}
        heading="Something went wrong"
        message={bloc.errorDetail}
        size="hero"
        action={{ label: 'Try again', onClick: () => bloc.retry(), variant: 'ghost' }}
      />
    {:else if bloc.filtered.length === 0}
      <EmptyState
        icon={sadFace}
        heading="No anime found"
        message={bloc.emptyMessage}
        size="hero"
        action={bloc.hasTagFilter
          ? { label: 'Clear filters', onClick: () => bloc.clearTags(), variant: 'ghost' }
          : undefined}
      />
    {:else}
      {#each bloc.filtered as anime, index (anime.id)}
        <div in:fly={{ y: 15, duration: 200, delay: Math.min(index * 20, 400) }}>
          <PosterCard
            id={anime.id}
            slug={anime.slug}
            title={bloc.titleFor(anime)}
            image={bloc.imageFor(anime)}
            score={bloc.scoreFor(anime)}
            status={anime.status || null}
            sub={bloc.subFor(anime)}
            genres={anime.tags || []}
            description={anime.description || ''}
            episodeCount={anime.episodeCount}
            onList={anime.userAnime?.status || null}
          />
        </div>
      {/each}
    {/if}
  </PosterGrid>
</div>
{/key}

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
    color: var(--weeb-accent-text);
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
    color: var(--weeb-accent-text);
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
    border: none;
    border-radius: 8px;
    background: none;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    text-decoration: none;
    cursor: pointer;
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
    cursor: pointer;
    transition: all 0.15s;
    text-decoration: none;
  }

  .season-arrow:hover {
    border-color: var(--weeb-accent);
    color: var(--weeb-accent-text);
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
    border: none;
    border-radius: 7px;
    background: none;
    font-family: var(--weeb-font-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--weeb-fg-muted);
    text-decoration: none;
    cursor: pointer;
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
    color: var(--weeb-accent-text);
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
    color: var(--weeb-accent-text);
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
    color: var(--weeb-accent-text);
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
    color: var(--weeb-accent-text);
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
    font-family: inherit;
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
    color: var(--weeb-accent-text);
  }

  /* Poster grid: see PosterGrid.svelte. Skeletons and empty states are the
     shared primitives, slotted into it. */

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .season-page {
      padding: 24px 16px 0;
    }

    .page-title {
      font-size: 24px;
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
    .season-tabs {
      overflow-x: auto;
    }

    .year-selector {
      overflow-x: auto;
    }
  }
</style>
