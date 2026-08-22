<script lang="ts">
  import SafeImage from './SafeImage.svelte';
  import { getYearUTC } from '../../services/utils';

  export let related: any[] = [];
  /** The anime being viewed, so it can be placed in its own timeline. */
  export let current: any = null;

  /**
   * The API returns the other entries oldest first. Slotting the current anime
   * into that order turns a list of "other things" into a timeline the reader
   * can locate themselves in -- which is the whole value of the grouping, since
   * a shared series id says these belong together but not which came first.
   */
  $: timeline = [...related, ...(current ? [{ ...current, isCurrent: true }] : [])].sort((a, b) => {
    // Undated entries last rather than first: an unaired special should not
    // open the history of a series that started in 1998.
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  function href(entry: any): string {
    return `/anime/${entry.slug || entry.id}`;
  }

  /** TV is the through-line of a series; everything else hangs off it. */
  function isMainEntry(type: string | null | undefined): boolean {
    return (type || '').toLowerCase() === 'tv';
  }
</script>

{#if timeline.length > 1}
  <ul class="rel-list">
    {#each timeline as entry (entry.id)}
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
              {#if entry.isCurrent}
                <span class="rel-here">You are here</span>
              {/if}
            </span>
          </div>
        </svelte:element>
      </li>
    {/each}
  </ul>
{/if}

<style>
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
