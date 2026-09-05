<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { breadcrumbSchema } from '$lib/structured-data';
  import PosterCard from '../../../svelte/components/PosterCard.svelte';
  import PosterGrid from '../../../svelte/components/PosterGrid.svelte';
  import KeyArtStage from '../../../svelte/components/KeyArtStage.svelte';
  import ErrorBanner from '../../../svelte/components/ErrorBanner.svelte';
  import EmptyState from '../../../svelte/components/EmptyState.svelte';
  import { GetImageFromAnime, seriesHref } from '../../../services/utils';
  import { SeriesPageBloc, type SeriesEntry } from '../../../svelte/components/SeriesPage.bloc.svelte';

  /**
   * Every anime sharing a series id, laid out season by season.
   *
   * A view over the bloc: it decides the grouping, the summary line and which
   * entry's key art stands for the series; this renders them.
   */
  let {
    data,
    /**
     * Defaults to a bloc reading the loader's payload, so the first (server)
     * frame already has its groups.
     */
    bloc = new SeriesPageBloc({
      source: () => ({
        /** Every anime sharing the series id, oldest first as the API returns them. */
        entries: data.ssrEntries ?? [],
        seriesTitle: data.seriesTitle ?? 'Series',
        ssrError: data.ssrError ?? null,
      }),
    }),
  }: {
    data: {
      seriesId: string;
      seriesSlug?: string | null;
      seriesTitle: string;
      seriesDescription?: string;
      seriesImage?: string;
      ssrEntries?: SeriesEntry[];
      ssrError?: string | null;
    };
    bloc?: SeriesPageBloc;
  } = $props();

  const SITE_URL = 'https://weeb.vip';

  // Built from the id and the anchor's current slug rather than from the URL
  // that was requested, so the breadcrumb names one page however it was reached.
  const canonical = $derived(`${SITE_URL}${seriesHref(data.seriesId, data.seriesSlug)}`);
  const schemas = $derived([
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: data.seriesTitle, url: canonical }
    ])
  ]);
</script>

<Seo title={data.seriesTitle} description={data.seriesDescription} image={data.seriesImage} />
<StructuredData {schemas} />

<div class="series-page">
  {#if bloc.ssrError}
    <div class="series-error">
      <ErrorBanner message="Couldn’t load this series." detail={bloc.ssrError} />
    </div>
  {:else}
    <!-- Half height, not the show page's full viewport. There the artwork is
         the subject; here the subject is the list, and a full-screen banner
         would push every season below the fold on the one page whose whole job
         is showing them together. -->
    <KeyArtStage imageId={bloc.anchorImageId} minHeight="clamp(300px, 46svh, 520px)">
      <header class="page-header">
        <p class="page-eyebrow">Series</p>
        <h1 class="page-title">{bloc.seriesTitle}</h1>
        <p class="series-summary">{bloc.summary}</p>
      </header>
    </KeyArtStage>

    <div class="series-body">
      {#each bloc.groups as group (group.key)}
        <section class="series-group" aria-label={group.heading}>
          <h2 class="series-group-heading">{group.heading}</h2>
          <PosterGrid>
            {#each group.items as entry (entry.id)}
              <PosterCard
                id={entry.id ?? ''}
                slug={entry.slug}
                title={bloc.titleFor(entry)}
                image={GetImageFromAnime(entry)}
                status={entry.animeStatus || null}
                sub={bloc.subtitleFor(entry)}
                genres={entry.tags || []}
                description={entry.description || ''}
                episodeCount={entry.episodeCount}
                onList={entry.userAnime?.status || null}
              />
            {/each}
          </PosterGrid>
        </section>
      {:else}
        <!-- A series id that resolves to nothing. Rare, but it is a real answer
             rather than a failure, so it says so instead of leaving the page
             blank under the banner. -->
        <EmptyState
          heading="Nothing in this series yet"
          message="No entries have been linked to this series."
          action={{ label: 'Browse anime', href: '/search', variant: 'ghost' }}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .series-body {
    padding: 32px var(--weeb-section-px, 48px) 64px;
    max-width: 1600px;
    margin: 0 auto;
  }

  /* No bottom margin: the stage's own below-fold band is the gap. */
  .page-header {
    max-width: 1600px;
    margin: 0 auto;
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
    text-wrap: balance;
  }

  .series-summary {
    margin-top: 10px;
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    letter-spacing: 0.04em;
    color: var(--weeb-fg-muted);
  }

  .series-group + .series-group {
    margin-top: 40px;
  }

  .series-group-heading {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--weeb-fg);
    margin-bottom: 14px;
  }

  .series-error {
    padding: var(--weeb-section-py, 40px) var(--weeb-section-px, 48px);
  }

  @media (max-width: 768px) {
    .series-body {
      padding: 20px 16px 48px;
    }

    .page-title {
      font-size: 24px;
    }

    .series-group + .series-group {
      margin-top: 28px;
    }
  }
</style>
