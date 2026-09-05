<script lang="ts">
  import PosterCard from './PosterCard.svelte';
  import PosterGrid from './PosterGrid.svelte';
  import KeyArtStage from './KeyArtStage.svelte';
  import { GetImageFromAnime, getYearUTC, collapseSeasonParts } from '../../services/utils';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';

  /** Every anime sharing the series id, oldest first as the API returns them. */
  export let entries: any[] = [];
  export let seriesTitle: string = 'Series';
  export let ssrError: string | null = null;

  /**
   * One group per season, then everything the derivation could not place.
   *
   * Three buckets rather than one list, because they answer different
   * questions. The numbered seasons are the show in order -- what someone
   * arriving from "Season 4" came to see. Season 0 is TheTVDB's specials, which
   * belong to the series but not to its run. And the unplaced entries are the
   * honest remainder: most of the catalogue has no derived season, and a page
   * that quietly dropped them would claim a series is smaller than it is.
   */
  // A season split across two cours is one season, so only the original of
  // each is listed. See collapseSeasonParts for why the rule is the TheTVDB
  // season rather than the title.
  $: shown = collapseSeasonParts(entries);

  $: groups = (() => {
    const numbered = new Map<number, any[]>();
    const specials: any[] = [];
    const unplaced: any[] = [];

    for (const entry of shown) {
      const season = entry?.seasonNumber;
      if (season === null || season === undefined) {
        unplaced.push(entry);
      } else if (season === 0) {
        specials.push(entry);
      } else {
        if (!numbered.has(season)) numbered.set(season, []);
        numbered.get(season)!.push(entry);
      }
    }

    const byDate = (a: any, b: any) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    };

    const out = [...numbered.keys()]
      .sort((a, b) => a - b)
      .map((season) => ({
        key: `s${season}`,
        heading: `Season ${season}`,
        items: numbered.get(season)!.slice().sort(byDate)
      }));

    if (specials.length) {
      out.push({ key: 'specials', heading: 'Specials', items: specials.slice().sort(byDate) });
    }
    if (unplaced.length) {
      // Not "Unknown". The season is unknown; these entries are not, and most
      // of them are films and shorts that never belonged to a numbered run.
      out.push({ key: 'other', heading: 'Other entries', items: unplaced.slice().sort(byDate) });
    }

    return out;
  })();

  $: seasonCount = groups.filter((g) => g.key.startsWith('s')).length;

  // Assembled here rather than from inline {#if} blocks in the markup, which
  // swallowed the spaces around them and rendered "13 entriesacross 5 seasons".
  $: summary = [
    `${shown.length} ${shown.length === 1 ? 'entry' : 'entries'}`,
    seasonCount > 0 ? `across ${seasonCount} ${seasonCount === 1 ? 'season' : 'seasons'}` : '',
  ]
    .filter(Boolean)
    .join(' ') + (years ? ` \u00b7 ${years}` : '');

  // The span the series covers, from the entries we can date. One year when
  // everything landed in the same one, rather than "2016 – 2016".
  $: years = (() => {
    const all = shown
      .map((e) => getYearUTC(e.startDate))
      .filter((y) => y && y !== 'TBA')
      .sort();
    if (all.length === 0) return '';
    return all[0] === all[all.length - 1] ? all[0] : `${all[0]} – ${all[all.length - 1]}`;
  })();

  /**
   * The entry whose artwork stands for the series: its first season.
   *
   * The earliest TV entry, which is also the one that names the series -- the
   * same anchor the URL and the page title use, so the banner cannot end up
   * showing one thing while the heading says another. Falls back to the
   * earliest of anything for series that never had a TV run.
   */
  $: anchor = (() => {
    const byDate = [...shown].sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    return byDate.find((e) => (e.type || '').toLowerCase() === 'tv') || byDate[0];
  })();

  function entrySub(entry: any): string {
    const year = getYearUTC(entry.startDate);
    const type = entry.type || '';
    return [year, type].filter(Boolean).join(' · ');
  }
</script>

<div class="series-page">
  {#if ssrError}
    <p class="series-error">{ssrError}</p>
  {:else}
    <!-- Half height, not the show page's full viewport. There the artwork is
         the subject; here the subject is the list, and a full-screen banner
         would push every season below the fold on the one page whose whole job
         is showing them together. -->
    <KeyArtStage imageId={anchor?.id} minHeight="clamp(300px, 46svh, 520px)">
      <header class="page-header">
        <p class="page-eyebrow">Series</p>
        <h1 class="page-title">{seriesTitle}</h1>
        <p class="series-summary">{summary}</p>
      </header>
    </KeyArtStage>

    <div class="series-body">
    {#each groups as group (group.key)}
      <section class="series-group" aria-label={group.heading}>
        <h2 class="series-group-heading">{group.heading}</h2>
        <PosterGrid>
          {#each group.items as entry (entry.id)}
            <PosterCard
              id={entry.id}
              slug={entry.slug}
              title={getAnimeTitle(entry, $preferencesStore.titleLanguage)}
              image={GetImageFromAnime(entry)}
              status={entry.animeStatus || null}
              sub={entrySub(entry)}
              genres={entry.tags || []}
              description={entry.description || ''}
              episodeCount={entry.episodeCount}
              onList={entry.userAnime?.status || null}
            />
          {/each}
        </PosterGrid>
      </section>
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
    color: var(--weeb-fg-muted);
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
