<script lang="ts">
  import { page } from '$app/stores';
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { animeSchema, breadcrumbSchema } from '$lib/structured-data';
  import QueryProvider from '../../../svelte/components/QueryProvider.svelte';
  import { untrack } from 'svelte';
  import { format } from 'date-fns';
  import AnimeNews from '../../../svelte/components/AnimeNews.svelte';
  import CharactersWithStaff from '../../../svelte/components/CharactersWithStaff.svelte';
  import Episodes from '../../../svelte/components/Episodes.svelte';
  import ErrorBanner from '../../../svelte/components/ErrorBanner.svelte';
  import RelatedAnime from '../../../svelte/components/RelatedAnime.svelte';
  import ShowContentSkeleton from '../../../svelte/components/ShowContentSkeleton.svelte';
  import ShowHero from '../../../svelte/components/ShowHero.svelte';
  import ShowInformation from '../../../svelte/components/ShowInformation.svelte';
  import ShowQuickInfo from '../../../svelte/components/ShowQuickInfo.svelte';
  import ShowSchedulePanel from '../../../svelte/components/ShowSchedulePanel.svelte';
  import ShowSection from '../../../svelte/components/ShowSection.svelte';
  import ShowSectionNav from '../../../svelte/components/ShowSectionNav.svelte';
  import ShowStickyHeader from '../../../svelte/components/ShowStickyHeader.svelte';
  import ShowSynopsis from '../../../svelte/components/ShowSynopsis.svelte';
  import { ShowContentBloc, NEWS_LIMIT } from '../../../svelte/components/ShowContent.bloc.svelte';

  /**
   * The anime detail page.
   *
   * This file is now composition and nothing else: the hero, the quick-info
   * strip, the section nav and each section are their own components, and every
   * decision behind them -- SSR versus query, the scroll spy, the schedule, the
   * tracking writes -- lives in the bloc. What is left here is the page's
   * running order.
   */
  let {
    /** The loader's payload, so the first frame is the finished page. */
    data,
    bloc: injected = undefined,
  }: {
    data: any;
    bloc?: ShowContentBloc;
  } = $props();

  /**
   * The anime is the key.
   *
   * This route used to be `{#key data.animeId}<ShowContentWithProvider … />`:
   * following a related-anime link replaced the component, so the scroll spy,
   * the measured chrome and the query seeded by the constructor all started
   * over on the new show. SvelteKit reuses one `+page.svelte` across a param
   * change, so now that the page *is* the route the key is explicit -- a new
   * id rebuilds the bloc, and the markup below is keyed on the same value.
   */
  const animeId = $derived(data.animeId);

  const bloc = $derived.by(() => {
    const forAnime = animeId;
    return (
      injected ??
      new ShowContentBloc({
        source: () => ({
          animeId: forAnime,
          ssrAnimeData: data.ssrAnimeData ?? null,
          ssrCharactersData: data.ssrCharactersData ?? null,
          ssrError: data.ssrError ?? null,
        }),
      })
    );
  });

  /** Both pinned bars measure themselves; the bloc turns that into one offset. */
  let stickyHeight = $state(0);
  let tabBarHeight = $state(0);

  // Config, the scroll spy and the news flag, with their teardowns handed back
  // out. The old version latched them behind a `scrollListenerAttached` boolean
  // and re-attached from a setTimeout, which is why the listeners could outlive
  // the page.
  // `untrack`: init reads the section list to seed the scroll spy, and that
  // list follows the query. Without it the listeners would be torn down and
  // re-attached -- and the feature-flag poll restarted -- every time the query
  // moved, which is the churn the old `scrollListenerAttached` latch was
  // guarding against by hand.
  // The bloc itself is read outside the `untrack`, so a new anime still tears
  // the old listeners down and starts the new page's.
  $effect(() => {
    const current = bloc;
    return untrack(() => current.init());
  });
  $effect(() => bloc.publishStickyOffset());
  $effect(() => bloc.measureChrome(stickyHeight, tabBarHeight));

  const SITE_URL = 'https://weeb.vip';

  // Canonical host, not the request origin: these URLs identify the entity, and must
  // match the canonical tag rather than whichever deployment served the page.
  const canonical = $derived(`${SITE_URL}/anime/${data.animeSlug}`);
  const schemas = $derived([
    data.animeSchemaSource
      ? animeSchema(data.animeSchemaSource, canonical, new URL(data.animeImage, $page.url.origin).toString())
      : null,
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: data.animeTitle, url: canonical }
    ])
  ]);
</script>

<Seo
  title={data.animeTitle}
  description={data.animeDescription}
  image={data.animeImage}
/>

<StructuredData {schemas} />

<!-- QueryProvider is the one place a TanStack client is made: a fresh one per
     SSR request, the shared one in the browser. -->
{#key animeId}
<QueryProvider>
{#if bloc.status === 'loading'}
  <ShowContentSkeleton />
{:else if bloc.status === 'error'}
  <div class="show-error">
    <ErrorBanner
      message="We couldn't load this anime"
      detail={bloc.errorDetail}
      onRetry={() => bloc.retry()}
      retrying={bloc.isRetrying}
    />
  </div>
{:else}
  {@const anime = bloc.anime}

  {#snippet schedule()}
    <ShowSchedulePanel
      label={bloc.scheduleLabel}
      countdown={bloc.countdown}
      episodeNumber={bloc.episodeNumber}
      localTime={bloc.localTime}
      localZone={bloc.localZone}
      broadcastSlot={bloc.broadcastSlot}
      open={bloc.jstOpen}
      onToggle={() => bloc.toggleJst()}
      onClose={() => bloc.closeJst()}
    />
  {/snippet}

  <div class="show-root">
    <ShowStickyHeader
      {anime}
      title={bloc.title}
      background={bloc.stickyBackground}
      visible={bloc.stickyVisible}
      studio={bloc.studio}
      airingLabel={bloc.airing.label}
      bind:height={stickyHeight}
    />

    <ShowHero
      {anime}
      title={bloc.title}
      seasonText={bloc.seasonText}
      seriesLink={bloc.seriesLink}
      studio={bloc.studio}
      imageSources={bloc.imageSources}
      loaded={bloc.artLoaded}
      onArtChosen={() => bloc.artChosen()}
      aside={bloc.hasSchedule ? schedule : undefined}
    />

    <ShowQuickInfo
      {anime}
      airingLabel={bloc.airing.label}
      airing={bloc.airing.airing}
      studio={bloc.studio}
      episodeCount={bloc.episodes.length}
      nextChip={bloc.nextChip}
      canTrack={bloc.canTrack}
      pending={bloc.pending}
      score={bloc.score}
      watched={bloc.watchedCount}
      total={bloc.episodeTotal}
      onScore={(value) => bloc.setScore(value)}
      onStep={(delta) => bloc.stepEpisodes(delta)}
    />

    <ShowSectionNav
      sections={bloc.sections}
      active={bloc.activeSection}
      onSelect={(section) => bloc.selectSection(section)}
      top={bloc.tabBarTop}
      bind:height={tabBarHeight}
    />

    <main class="main-content">
      <div class="content-single">
        <ShowSection id={bloc.elementIdFor(bloc.sectionIds.SYNOPSIS)} heading="Synopsis">
          <ShowSynopsis description={anime.description} />
        </ShowSection>

        <!-- News sits directly under the synopsis because it is the only part
             of this page that changes after the first visit. Capped at the
             latest few; the rest live at /anime/<slug>/news. -->
        {#if bloc.showsNews}
          <ShowSection id={bloc.elementIdFor(bloc.sectionIds.NEWS)} heading="News">
            <AnimeNews news={bloc.news} limit={NEWS_LIMIT} viewAllHref={bloc.newsHref} />
          </ShowSection>
        {/if}

        {#if bloc.showsEpisodes}
          <ShowSection id={bloc.elementIdFor(bloc.sectionIds.EPISODES)} heading="Episodes">
            <Episodes
              episodes={bloc.episodes}
              watchedCount={bloc.watchedCount}
              watchedNumbers={bloc.watchedNumbers}
              canTrack={bloc.canTrack}
              pending={bloc.pending}
              onWatch={(intent) => bloc.markEpisode(intent)}
            />
          </ShowSection>
        {/if}

        <ShowSection id={bloc.elementIdFor(bloc.sectionIds.CHARACTERS)} heading="Characters & Staff">
          <CharactersWithStaff animeId={anime.id} ssrCharactersData={bloc.ssrCharactersData} />
        </ShowSection>

        <!-- Other entries in the same series: a way onward through the
             franchise, so it belongs with the browsing surfaces rather than
             with the reference data. Renders nothing when the anime has no
             TheTVDB series id, which is most of the catalogue -- an empty
             "Related" heading would assert this show stands alone, and a
             missing series id does not mean that. -->
        {#if bloc.relatedAnime.length > 0}
          <ShowSection id="show-section-related" heading="Related anime">
            <RelatedAnime related={bloc.relatedAnime} current={anime} />
          </ShowSection>
        {/if}

        <ShowSection id="show-section-information" heading="Information">
          <ShowInformation {anime} />
        </ShowSection>
      </div>

      <footer class="show-footer">
        <p>
          Last updated: {anime.updatedAt ? format(new Date(anime.updatedAt), 'dd MMM yyyy') : 'Unknown'}
        </p>
      </footer>
    </main>
  </div>
{/if}
</QueryProvider>
{/key}
<style>
  .show-root {
    min-height: 100vh;
    background: var(--weeb-bg);
    position: relative;
  }

  .show-error {
    min-height: 100vh;
    background: var(--weeb-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--weeb-section-py, 40px) var(--weeb-section-px, 48px);
  }

  /* Full width with the section gutter, matching the homepage. The hero runs
     edge to edge; a 1440px column underneath it left 1,086px of empty margin on
     a wide monitor and made the two halves of the page look unrelated.
     Everything that is READ keeps its own measure cap -- width is for content
     that tiles, not for lines of prose. */
  .main-content {
    width: 100%;
    padding: 0 var(--weeb-section-px, 48px);
  }

  .content-single {
    display: flex;
    flex-direction: column;
    gap: var(--weeb-section-py, 40px);
    padding: var(--weeb-section-py, 40px) 0 20px;
  }

  .show-footer {
    border-top: 1px solid var(--weeb-border);
    padding: 32px 0;
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
  .show-footer p {
    font-size: 12px;
    color: var(--weeb-fg-muted);
  }
</style>
