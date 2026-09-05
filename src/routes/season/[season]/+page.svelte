<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { itemListSchema, breadcrumbSchema } from '$lib/structured-data';
  import { fly } from 'svelte/transition';
  import PosterCard from '$lib/components/cards/PosterCard';
  import PosterGrid from '$lib/components/primitives/PosterGrid';
  import PosterCardSkeleton from '$lib/components/cards/PosterCardSkeleton';
  import EmptyState from '$lib/components/primitives/EmptyState';
  import SafeImage from '$lib/components/primitives/SafeImage';
  import ChipGroup, { type ChipGroupItem } from '$lib/components/primitives/ChipGroup';
  import { SeasonPageBloc, type SeasonalAnime } from './SeasonPage.bloc.svelte';

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

  /* The season strip, as ChipGroup items. The emoji rides along in a lookup
     rather than on the item, because ChipGroupItem's `icon` is a FontAwesome
     definition and these are characters. */
  const seasonItems = $derived<ChipGroupItem[]>(
    bloc.seasonTabs.map((tab) => ({ value: tab.key, label: tab.label }))
  );
  const seasonIcons = $derived(new Map(bloc.seasonTabs.map((tab) => [tab.key, tab.icon])));
  const activeSeasonKey = $derived(bloc.seasonTabs.find((tab) => tab.active)?.key ?? '');

  const yearItems = $derived<ChipGroupItem[]>(
    bloc.yearOptions.map((option) => ({ value: option.key, label: String(option.year) }))
  );
  const activeYearKey = $derived(bloc.yearOptions.find((option) => option.active)?.key ?? '');

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

{#snippet seasonIcon(item: ChipGroupItem)}
  <span class="season-tab-icon" aria-hidden="true">{seasonIcons.get(item.value ?? '') ?? ''}</span>
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
    <!--
      Not a tablist. These navigate to /season/<key>; they reveal no panel, so
      tab/tablist semantics would misdescribe them -- and `role="tab"` also
      overrides the implicit button role, which is what an assistive tech (and
      season.spec.ts) looks for. Hence ChipGroup's `mode="toggle"`, which leaves
      plain buttons, plus `activeMarker="current"` for the aria-current that
      marks the season being shown.
    -->
    <div class="season-tabs">
      <ChipGroup
        items={seasonItems}
        value={activeSeasonKey}
        onSelect={(key) => bloc.goToSeason(key)}
        variant="segmented"
        mode="toggle"
        activeMarker="current"
        size="touch"
        ariaLabel="Season"
        itemContent={seasonIcon}
      />
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

      <!-- Same strip, same primitive: this was a third copy of the segmented
           look. Mono digits are the one thing it keeps of its own. -->
      <div class="year-selector">
        <ChipGroup
          items={yearItems}
          value={activeYearKey}
          onSelect={(key) => bloc.goToSeason(key)}
          variant="segmented"
          mode="toggle"
          activeMarker="current"
          size="touch"
          ariaLabel="Year"
        />
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
    <!-- Multi-select: every selected tag has to match, so `select="multi"`.
         /search's genre facets are the same row and the same component. -->
    <div class="tag-filter">
      <ChipGroup
        select="multi"
        items={bloc.visibleTags.map((facet) => ({
          value: facet.tag,
          label: facet.tag,
          count: facet.count,
        }))}
        isSelected={(tag) => bloc.isTagSelected(tag)}
        onSelect={(tag) => bloc.toggleTag(tag)}
        clear={bloc.hasTagFilter ? { onClear: () => bloc.clearTags() } : undefined}
        more={bloc.hasHiddenTags
          ? {
              hiddenCount: bloc.hiddenTagCount,
              expanded: bloc.showAllTags,
              onToggle: () => bloc.toggleShowAllTags(),
              collapseLabel: 'Show less',
            }
          : undefined}
        ariaLabel="Filter by tag"
      />
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

  /* Both strips are Primitives/ChipGroup now; these wrappers only place them. */
  .season-tabs {
    display: flex;
    min-width: 0;
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

  /* Matched to the strips beside it, which are now on the 44px touch target. */
  .season-arrow {
    width: 44px;
    height: 44px;
    border-radius: var(--weeb-radius-full);
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
    min-width: 0;
  }

  /* Years read as data, so they keep the mono face the rest of this page's
     figures use. Everything else about the strip is the primitive's. */
  .year-selector :global(.chipgroup--segmented .chip.cg-item) {
    font-family: var(--weeb-font-mono);
    font-weight: 600;
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
    border-radius: var(--weeb-radius-lg);
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
    border-radius: var(--weeb-radius);
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
    border-radius: var(--weeb-radius);
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
  }

  /* ── Tag filter ──
     The row itself is Primitives/ChipGroup, which also carries the clear and
     "+N more" chips. The old copy here hardcoded `oklch(100% 0 0 / 0.2)` on the
     selected count badge, which the design system forbids outright. */
  .tag-filter {
    margin-bottom: 24px;
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
      border-radius: var(--weeb-radius);
      margin-bottom: 24px;
    }

    .top-strip-title {
      max-width: 140px;
    }
  }

  @media (max-width: 480px) {
    /* The segmented boxes do not wrap; they scroll. */
    .season-tabs,
    .year-selector {
      max-width: 100%;
      overflow-x: auto;
      scrollbar-width: none;
    }
  }
</style>
