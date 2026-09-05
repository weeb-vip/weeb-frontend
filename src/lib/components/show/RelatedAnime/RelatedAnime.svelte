<script lang="ts">
  import Chip from '$lib/components/primitives/Chip';
  import SafeImage from '$lib/components/primitives/SafeImage';
  import SectionHeader from '$lib/components/primitives/SectionHeader';
  import { getYearUTC, seasonLabel, seriesLinkFor } from '$lib/services/utils';
  import { entryHref as href, isMainEntry, relatedGroups } from './RelatedAnime.logic';

  let {
    /** RelatedAnime entries: { relation, anime }. */
    related = [],
    /** The anime being viewed, so it can be placed in its own timeline. */
    current = null,
  }: { related?: any[]; current?: any } = $props();

  const groups = $derived(relatedGroups(related, current));

  // Shared with the hero's season label, which links to the same page: two
  // copies of "which entry names this series" would eventually disagree.
  const seriesLink = $derived(seriesLinkFor(current));
</script>

{#each groups as group (group.kind)}
  {#if group.items.length > 1 || group.kind !== 'SAME_SERIES'}
    <div class="rel-group">
      <!-- The eyebrow scale of the one section heading. The link beside it is
           only on the same-series list: that is the one group that is a
           timeline of a single thing, and so the only one a series page could
           show more of. -->
      <SectionHeader
        title={group.heading}
        as="h3"
        size="eyebrow"
        href={group.kind === 'SAME_SERIES' && seriesLink ? seriesLink : ''}
        linkText="View all seasons &rarr;"
      />
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
                    <Chip label={entry.type} size="sm" tone={isMainEntry(entry.type) ? 'accent' : 'neutral'} />
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
    border-radius: var(--weeb-radius);
    text-decoration: none;
    color: inherit;
    transition: background 0.15s, border-color 0.15s;
  }
  a.rel-card:hover {
    background: var(--weeb-surface-hover);
    border-color: var(--weeb-accent);
  }
  a.rel-card:hover .rel-title {
    color: var(--weeb-accent-text);
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
    border-radius: var(--weeb-radius-sm);
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
    line-clamp: 2;
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

  /* Accent text on no background, where the TV chip is accent text on a filled
     one. Same colour ties it to the season line on the show page; the missing
     fill keeps the two apart on a card that shows both. */
  .rel-season {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--weeb-accent-text);
    white-space: nowrap;
  }

  .rel-here {
    font-size: 10px;
    font-weight: 600;
    color: var(--weeb-accent-text);
  }

  @media (max-width: 640px) {
    .rel-list {
      grid-template-columns: 1fr;
    }
  }
</style>
