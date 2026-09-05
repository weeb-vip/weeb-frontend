<script lang="ts">
  import SafeImage from './SafeImage.svelte';
  import { getYearUTC, seasonLabel } from '../../services/utils';

  /** RelatedAnime entries: { relation, anime }. */
  export let related: any[] = [];
  /** The anime being viewed, so it can be placed in its own timeline. */
  export let current: any = null;

  /**
   * Heading per relation kind. Entries in the same series are not "related" to
   * this anime -- they are this anime, in another form -- so they get their own
   * heading rather than being pooled with genuinely separate works.
   *
   * Unknown kinds fall back rather than vanishing: the API will grow kinds
   * (a shared source work, a shared creator) before this list learns their
   * names, and silently dropping them would hide data the server sent.
   */
  const HEADINGS: Record<string, string> = {
    SAME_SERIES: 'Same series'
  };
  const FALLBACK_HEADING = 'Related';

  // Order the headings deliberately; same-series first, since it is the
  // closest relationship and the one most readers are looking for.
  const ORDER = ['SAME_SERIES'];

  $: groups = (() => {
    const byKind = new Map<string, any[]>();
    for (const entry of related) {
      if (!entry?.anime) continue;
      const kind = entry.relation || FALLBACK_HEADING;
      if (!byKind.has(kind)) byKind.set(kind, []);
      byKind.get(kind)!.push(entry.anime);
    }

    // The current anime belongs in the same-series timeline, where the ordering
    // means something. It is not added to other kinds: a spin-off list has no
    // "you are here" position.
    const sameSeries = byKind.get('SAME_SERIES');
    if (sameSeries && current) {
      sameSeries.push({ ...current, isCurrent: true });
    }

    const kinds = [...byKind.keys()].sort((a, b) => {
      const ai = ORDER.indexOf(a), bi = ORDER.indexOf(b);
      return (ai === -1 ? ORDER.length : ai) - (bi === -1 ? ORDER.length : bi);
    });

    return kinds.map((kind) => ({
      kind,
      heading: HEADINGS[kind] ?? FALLBACK_HEADING,
      // Air-date order, undated last: an unaired special should not open the
      // history of a series that began in 1998.
      items: byKind.get(kind)!.slice().sort((a, b) => {
        if (!a.startDate && !b.startDate) return 0;
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      })
    }));
  })();

  function href(entry: any): string {
    return `/anime/${entry.slug || entry.id}`;
  }

  /** TV is the through-line of a series; everything else hangs off it. */
  function isMainEntry(type: string | null | undefined): boolean {
    return (type || '').toLowerCase() === 'tv';
  }
</script>

{#each groups as group (group.kind)}
  {#if group.items.length > 1 || group.kind !== 'SAME_SERIES'}
    <div class="rel-group">
      <h3 class="rel-group-heading">{group.heading}</h3>
      <ul class="rel-list">
        {#each group.items as entry (entry.id)}
          <!-- Not when it would repeat the type chip verbatim. A season-0 entry
               already typed "Special" would otherwise read "Special Special";
               "TV Special" differs from "Special" and keeps both, because there
               the two words are saying different things. -->
          {@const seasonText = seasonLabel(entry.seasonNumber)}
          {@const season = seasonText.toLowerCase() === (entry.type || '').toLowerCase() ? '' : seasonText}
          <li class="rel-item" class:current={entry.isCurrent}>
            <svelte:element
              this={entry.isCurrent ? 'div' : 'a'}
              href={entry.isCurrent ? undefined : href(entry)}
              aria-current={entry.isCurrent ? 'page' : undefined}
              class="rel-card"
            >
              <div class="rel-poster">
                <SafeImage
                  src={entry.id}
                  alt={entry.titleEn || entry.titleJp || ''}
                  className="rel-poster-img"
                />
              </div>
              <div class="rel-text">
                <span class="rel-title">{entry.titleEn || entry.titleJp}</span>
                <span class="rel-meta">
                  <span class="rel-year">{getYearUTC(entry.startDate)}</span>
                  {#if entry.type}
                    <span class="rel-type" class:main={isMainEntry(entry.type)}>{entry.type}</span>
                  {/if}
                  <!-- Which run of the series this entry is. The reason the
                       list is worth reading in order, so it earns the accent
                       the type chip does not. Absent for most of the
                       catalogue, and rendered as nothing when so. -->
                  {#if season}
                    <span class="rel-season">{season}</span>
                  {/if}
                  {#if entry.isCurrent}
                    <span class="rel-here">You are here</span>
                  {/if}
                </span>
              </div>
            </svelte:element>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
{/each}

<style>
  .rel-group + .rel-group {
    margin-top: 20px;
  }

  .rel-group-heading {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted);
  }

  .rel-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 12px;
  }

  .rel-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    text-decoration: none;
    color: inherit;
    transition: background 0.15s, border-color 0.15s;
  }
  a.rel-card:hover {
    background: var(--weeb-surface-hover);
    border-color: var(--weeb-accent);
  }
  a.rel-card:hover .rel-title {
    color: var(--weeb-accent-text, var(--weeb-fg));
  }

  /* The current entry is present for orientation, not navigation: it reads as
     part of the timeline but is deliberately not a link to itself. */
  .rel-item.current .rel-card {
    background: color-mix(in oklch, var(--weeb-accent) 12%, var(--weeb-surface));
    border-color: var(--weeb-accent);
    cursor: default;
  }

  .rel-poster {
    flex-shrink: 0;
    width: 40px;
    height: 56px;
    border-radius: var(--weeb-radius-sm, 4px);
    overflow: hidden;
    background: var(--weeb-bg-elevated);
  }
  .rel-poster :global(.rel-poster-img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .rel-text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .rel-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--weeb-fg);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    transition: color 0.15s;
  }

  .rel-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .rel-year {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--weeb-fg-muted);
  }

  .rel-type {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: var(--weeb-radius-sm, 4px);
    background: var(--weeb-bg-elevated);
    color: var(--weeb-fg-muted);
    white-space: nowrap;
  }
  .rel-type.main {
    background: color-mix(in oklch, var(--weeb-accent) 18%, transparent);
    color: var(--weeb-accent-text, var(--weeb-fg));
  }

  /* Accent text on no background, where the TV chip is accent text on a filled
     one. Same colour ties it to the season line on the show page; the missing
     fill keeps the two apart on a card that shows both. */
  .rel-season {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--weeb-accent-text, var(--weeb-fg));
    white-space: nowrap;
  }

  .rel-here {
    font-size: 10px;
    font-weight: 600;
    color: var(--weeb-accent-text, var(--weeb-fg));
  }

  @media (max-width: 640px) {
    .rel-list {
      grid-template-columns: 1fr;
    }
  }
</style>
