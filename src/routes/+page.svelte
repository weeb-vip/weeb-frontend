<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import HeroBanner from '$lib/components/home/HeroBanner';
  import HeroBannerSkeleton from '$lib/components/home/HeroBannerSkeleton';
  import HeroAiringRail from '$lib/components/home/HeroAiringRail';
  import PosterCard from '$lib/components/cards/PosterCard';
  import PosterCardSkeleton from '$lib/components/cards/PosterCardSkeleton';
  import PosterGrid from '$lib/components/primitives/PosterGrid';
  import SectionHeader from '$lib/components/primitives/SectionHeader';
  import ChipGroup from '$lib/components/primitives/ChipGroup';
  import { BROWSE_GENRE_LINKS } from '$lib/data/genres';
  import { HomepageBloc, type HomeAnime, type PublishingWork } from './HomepageSSR.bloc.svelte';
  import '@fortawesome/fontawesome-free/css/all.min.css';

  /**
   * The homepage: the airing hero and its rail, then the shelves.
   *
   * A view over the bloc: it owns the three queries, the season the highlights
   * shelf is on, the hero's current pick and the one clock both the hero and
   * the rail count down from.
   */
  let {
    data,
    bloc = new HomepageBloc({
      source: () => ({
        homeData: data.homeData ?? null,
        currentlyAiringData: data.currentlyAiringData ?? null,
        seasonalData: data.seasonalData ?? null,
        publishingWorksData: data.publishingWorksData ?? null,
        currentSeason: data.currentSeason,
        isTokenExpired: data.isTokenExpired ?? false,
      }),
    }),
  }: {
    data: {
      homeData?: { topRatedAnime?: HomeAnime[] | null } | null;
      currentlyAiringData?: { currentlyAiring?: HomeAnime[] | null } | null;
      seasonalData?: { animeBySeasons?: HomeAnime[] | null } | null;
      publishingWorksData?: { currentlyPublishingWorks?: PublishingWork[] | null } | null;
      currentSeason: string;
      isTokenExpired?: boolean;
      /** Preloaded in `<svelte:head>`; the hero resolves its own art from the data. */
      bannerImageUrl?: string | null;
    };
    bloc?: HomepageBloc;
  } = $props();

  $effect(() => bloc.init());

  // The worker only has something to schedule once the airing data has landed.
  $effect(() => {
    if (bloc.hasAiring) bloc.refreshNotifications();
  });
</script>

<!-- No title, so Seo falls back to "WeebVIP - Track Your Anime Watchlist". This is the
     most-linked page on the site and "Home | WeebVIP" says nothing about what it is. -->
<Seo
  description="Discover and track your favorite anime. Get notifications for new episodes, explore seasonal anime, and manage your watchlist."
/>

<svelte:head>
  {#if data.bannerImageUrl}
    <link rel="preload" as="image" href={data.bannerImageUrl} fetchpriority="high" />
  {/if}
</svelte:head>

<div class="homepage">
  <!-- The page's actual heading. Visually hidden because the design leads with the hero
       carousel rather than a title, but the document still needs one h1 describing the
       page: the only h1 used to be the carousel's current anime, so the homepage's
       primary heading changed with whichever show happened to be featured. -->
  <h1 class="sr-only">WeebVIP — track your anime watchlist</h1>

  {#if bloc.hasAiring}
    <div class="hero-wrapper">
      {#if bloc.bannerAnime}
        {#key bloc.bannerId}
          <HeroBanner anime={bloc.bannerAnime} timing={bloc.bannerTiming} />
        {/key}
      {:else}
        <HeroBannerSkeleton />
      {/if}
      <!-- Sibling of the keyed banner, not a child: the banner remounts on every
           selection and the rail must not, or it would lose focus mid-keyboard
           navigation. -->
      <HeroAiringRail
        entries={bloc.airingEntries}
        activeId={bloc.bannerId}
        onSelect={(info) => bloc.select(info)}
      />
    </div>
  {:else if bloc.fallbackBannerAnime}
    <div class="hero-wrapper">
      <HeroBanner anime={bloc.fallbackBannerAnime} />
    </div>
  {/if}

  <!-- Airing from your list.
       First thing under the hero, because the product's recurring loop starts
       with "what aired for the shows I follow" and nothing on this page used to
       answer it. Renders only when there is something in it, so a signed-out
       homepage is unchanged rather than carrying an empty shelf. -->
  {#if bloc.myAiring.length > 0}
    <section class="section">
      <SectionHeader title="Airing from your list" href="/profile/anime" linkText="Your list →" />
      <PosterGrid>
        {#each bloc.myAiring as entry (entry.anime.id)}
          <!-- status comes off airingInfo: the anime object is rebuilt field by
               field in the bloc and drops animeStatus, while airingInfo spreads
               the whole record. -->
          <PosterCard
            id={entry.anime.id}
            slug={entry.anime.slug}
            title={bloc.titleFor(entry.anime)}
            image={bloc.imageFor(entry.anime)}
            status={entry.airingInfo.animeStatus || null}
            sub={bloc.watchingSub(entry)}
            genres={entry.anime.tags || []}
            description={entry.anime.description || ''}
            episodeCount={entry.anime.episodeCount}
            onList={entry.anime.userAnime?.status || null}
          />
        {/each}
      </PosterGrid>
    </section>
  {/if}

  <!-- Seasonal Highlights -->
  <section class="section">
    <div class="section-header-with-tabs">
      <SectionHeader
        title="{bloc.seasonLabel(bloc.selectedSeason)} Highlights"
        href="/season/{bloc.selectedSeason}"
        linkText="Full season →"
      />
      <!-- The same segmented strip as /season's, now off the same primitive.
           The two had drifted into different padding, type size, weight, radius
           and hover colour while doing one job; the only value worth keeping was
           this one's 44px touch target, which `size="touch"` now carries for
           both. This strip swaps the shelf in place rather than navigating, so
           it stays on aria-pressed. -->
      <div class="season-tabs">
        <ChipGroup
          items={bloc.seasonOptions.map((season) => ({
            value: season,
            label: bloc.seasonLabel(season),
          }))}
          value={bloc.selectedSeason}
          onSelect={(season) => bloc.selectSeason(season)}
          variant="segmented"
          mode="toggle"
          size="touch"
          ariaLabel="Season"
        />
      </div>
    </div>
    <PosterGrid>
      {#if bloc.isSeasonLoading}
        {#each Array(12) as _, index (index)}
          <PosterCardSkeleton />
        {/each}
      {:else}
        {#each bloc.seasonalAnime as anime (anime.id)}
          <PosterCard
            id={anime.id}
            slug={anime.slug}
            title={bloc.titleFor(anime)}
            image={bloc.imageFor(anime)}
            score={anime.rating}
            status={anime.status}
            genres={anime.tags || []}
            description={anime.description || ''}
            episodeCount={anime.episodeCount}
            sub={bloc.posterSub(anime)}
            onList={anime.userAnime?.status || null}
          />
        {/each}
      {/if}
    </PosterGrid>
  </section>

  <!-- Top Rated -->
  {#if bloc.hasTopRated}
    <section class="section">
      <SectionHeader title="Top Rated" href="/search" linkText="See all →" />
      <PosterGrid>
        {#each bloc.topRated as anime (anime.id)}
          <PosterCard
            id={anime.id}
            slug={anime.slug}
            title={bloc.titleFor(anime)}
            image={bloc.imageFor(anime)}
            score={anime.rating}
            status={anime.status}
            genres={anime.tags || []}
            description={anime.description || ''}
            episodeCount={anime.episodeCount}
            sub={bloc.posterSub(anime)}
            onList={anime.userAnime?.status || null}
          />
        {/each}
      </PosterGrid>
    </section>
  {/if}

  <!-- Still Publishing -->
  {#if bloc.publishingWorks.length > 0}
    <section class="section">
      <SectionHeader title="Still Publishing" />
      <PosterGrid>
        {#each bloc.publishingWorks as work (work.id)}
          <PosterCard
            id={work.id}
            title={work.titleEn || work.titleJp || ''}
            image={work.id}
            imagePath="works"
            score={work.score}
            sub={bloc.workSub(work)}
            href={`/manga/${work.urlSlug}`}
          />
        {/each}
      </PosterGrid>
    </section>
  {/if}

  <!-- Browse by Tag -->
  <section class="section">
    <SectionHeader title="Browse by Tag" />
    <!-- The genre list is data (`$lib/data/genres`) and the row is Chips; it
         used to be sixteen names hardcoded as a default prop inside the
         presentational component that drew them. `select="none"` is the row
         that picks nothing: every chip is a link out to /search. -->
    <ChipGroup items={BROWSE_GENRE_LINKS} select="none" size="touch" ariaLabel="Browse by tag" />
  </section>
</div>

<style>
  .homepage {
    width: 100%;
    overflow-x: clip;
  }
  /* The banner runs up under the transparent nav, so it starts at the top of the
     document rather than below the bar. */
  .hero-wrapper {
    /* Extra banner below the fold carrying the dissolve into the page ground.
       The first screen stays pure artwork; the fade is only ever revealed by
       scrolling. Everything bottom-anchored inside the banner offsets by this
       same value so the composition does not move down with it. */
    --hero-fade: 100px;
    width: 100%;
    position: relative;
    margin-top: calc(-1 * var(--weeb-nav-height, 60px));
  }
  @media (max-width: 767px) {
    .hero-wrapper { --hero-fade: 70px; }
  }

  /* --- SECTIONS --- */
  .section {
    padding: 48px var(--weeb-section-px, 48px);
  }
  .section + .section {
    border-top: 1px solid var(--weeb-border, oklch(28% 0.015 275));
  }

  /* --- POSTER GRID ---
     A grid, not a horizontal shelf. A carousel inside a vertically scrolling
     page asks the reader to change gesture axis to reach content, and on a phone
     it competes with the page scroll itself; everything past the second card
     goes unseen. The grid also fills its row for free -- auto-fill with 1fr
     tracks stretches to the full width whatever the item count, which a
     fixed-width shelf cannot do without either stranding a gap or inflating the
     cards.

     The length problem a grid used to have was never the grid. It was fourteen
     items in it: at two columns that is seven rows per section. The count is
     capped per breakpoint instead (see the bloc's shelfLimit).
     The grid itself lives in PosterGrid.svelte, the placeholders in
     PosterCardSkeleton.svelte. */

  /* --- SEASON TABS --- */
  .section-header-with-tabs {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }
  .section-header-with-tabs :global(.section-header) {
    margin-bottom: 0;
  }
  /* The strip itself is Primitives/ChipGroup; this only places it. */
  .season-tabs {
    display: flex;
  }

  /* --- RESPONSIVE --- */
  @media (max-width: 767px) {
    .section {
      padding: var(--weeb-section-py, 32px) var(--weeb-section-px, 24px);
    }
    /* The segmented box does not wrap, so on a narrow screen it scrolls -- the
       same thing /season's copy of this strip does. */
    .season-tabs {
      max-width: 100%;
      overflow-x: auto;
      scrollbar-width: none;
    }
  }
  @media (max-width: 400px) {
    .section {
      padding: var(--weeb-section-py, 24px) var(--weeb-section-px, 16px);
    }
  }
</style>
