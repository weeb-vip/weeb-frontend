<script lang="ts">
  import SafeImage from './SafeImage.svelte';
  import { GetImageFromAnime, animeHref } from '../../services/utils';
  import { analytics } from '../../utils/analytics';
  import { getAnimeTitle, preferencesStore } from '../stores/preferences';

  /**
   * Presentational -- no bloc. Every row is drawn from the entry it is given;
   * the timings were resolved once in HomepageSSR, and hovering a row only
   * hands the entry back to whoever owns the banner.
   */
  let {
    /** Entries from HomepageSSR's sortedCurrentlyAiring. */
    entries = [],
    activeId = null,
    /** Hovering or focusing an entry retargets the banner behind this rail. */
    onSelect = () => {},
  }: {
    entries?: any[];
    activeId?: string | null;
    onSelect?: (info: any) => void;
  } = $props();

  const LIMIT = 8;
  const shown = $derived(entries.slice(0, LIMIT));

  // Every field here comes off the one EpisodeTiming resolved in
  // HomepageSSR.processCurrentlyAiring. The rail no longer formats a time or
  // reads a variant of its own: when it did, it printed the exact airTime while
  // the hero printed the reconstructed broadcast slot, and the two disagreed.
  // The rail says when, in its own short form, rather than reusing
  // timing.label.
  //
  // label is written for surfaces that show nothing else -- so past a day out
  // it reads "Airing Tue 7:30 AM". Here that is the same string the row already
  // prints on the line below the title, so every row beyond tomorrow said the
  // time twice.
  //
  // It also cost the titles. This column is content-sized and the title column
  // absorbs whatever is left, so a row reading "Airing Tue 10:00 AM" truncated
  // its title far earlier than one reading "Airing in 15h" -- the same show
  // ellipsised at a different place depending on how far away it airs.
  //
  // These forms are short and near enough to one width that the titles line up.
  function when(timing: any): string {
    if (!timing) return '';
    if (timing.isLive) return timing.countdown === 'AIRING NOW' ? 'Now' : timing.countdown;
    if (timing.hasAired) return 'Aired';
    // Inside a day the shared countdown is already the right shape: 45m, 15h.
    if (timing.countdown) return `in ${timing.countdown}`;
    // Beyond that, days -- the exact time is on the line below.
    const start = timing.airDateTime ? new Date(timing.airDateTime).getTime() : NaN;
    if (Number.isNaN(start)) return '';
    const days = Math.max(1, Math.ceil((start - Date.now()) / 86400000));

    return `in ${days}d`;
  }

  function meta(entry: any) {
    const timing = entry.airingInfo?.timing;
    const current = entry.airingInfo?.nextEpisode?.episodeNumber ?? 0;
    return {
      episode: current ? `EP ${current}` : '',
      localTime: timing?.localTime ?? '',
      countdown: when(timing),
      isLive: timing?.isLive ?? false
    };
  }
</script>

{#if shown.length > 0}
  <!-- Frosted glass, not a solid panel: DESIGN.md's saturate() boost carries the
       key art's colour through, so the rail belongs to whatever banner is behind
       it instead of punching a grey hole in it. -->
  <aside class="rail" aria-label="Airing next">
    <div class="rail-head">
      <h2 class="rail-title">Airing Next</h2>
      <a class="rail-all" href="/airing">Full schedule &rarr;</a>
    </div>

    <ul class="rail-list">
      {#each shown as entry (entry.anime.id)}
        {@const m = meta(entry)}
        <li>
          <a
            class="rail-item"
            class:is-active={activeId === entry.anime.id}
            href={animeHref(entry.anime)}
            aria-current={activeId === entry.anime.id ? 'true' : undefined}
            onmouseenter={() => onSelect(entry.airingInfo)}
            onfocus={() => onSelect(entry.airingInfo)}
            onclick={() => analytics.animeViewed(entry.anime.id, entry.anime.titleEn)}
          >
            <span class="rail-art">
              <SafeImage
                src={GetImageFromAnime(entry.anime)}
                alt=""
                className="rail-art-img"
                fallbackSrc="/assets/not found.jpg"
                cdnWidth={120}
              />
            </span>

            <span class="rail-body">
              <span class="rail-name">
                {getAnimeTitle(entry.anime, $preferencesStore.titleLanguage)}
              </span>
              <span class="rail-line">
                {#if m.episode}<span class="rail-ep">{m.episode}</span>{/if}
                {#if m.localTime}<span class="rail-local">{m.localTime}</span>{/if}
              </span>
            </span>

            <span class="rail-when" class:is-live={m.isLive}>
              {#if m.isLive}<span class="rail-dot" aria-hidden="true"></span>{/if}
              {m.countdown}
            </span>
          </a>
        </li>
      {/each}
    </ul>
  </aside>
{/if}

<style>
  .rail {
    position: absolute;
    z-index: 4;
    border-radius: var(--weeb-radius-lg, 12px);
    background: var(--weeb-panel-bg, var(--weeb-surface));
    backdrop-filter: var(--weeb-panel-blur);
    -webkit-backdrop-filter: var(--weeb-panel-blur);
    border: 1px solid var(--weeb-border);
    box-shadow: var(--weeb-shadow-card, 0 12px 32px oklch(0% 0 0 / 0.4));
  }

  .rail-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .rail-title {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--weeb-fg-secondary);
  }
  .rail-all {
    position: relative;
    color: var(--weeb-fg-secondary);
    text-decoration: none;
    white-space: nowrap;
    /* Label step. This declared no size, so it inherited the browser default
       16px and rendered a third larger than the identical "See all" link on
       every other shelf. */
    font-size: 12px;
    font-weight: 600;
  }
  /* WCAG 2.5.5: 92x18 as drawn, 44 tall as a target. */
  .rail-all::after {
    content: '';
    position: absolute;
    inset: -13px -8px;
  }
  .rail-all:hover { color: var(--weeb-fg); }
  .rail-all:focus-visible {
    outline: 2px solid var(--weeb-accent-text);
    outline-offset: 2px;
    border-radius: var(--weeb-radius-sm, 4px);
  }

  .rail-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .rail-item {
    display: flex;
    gap: 10px;
    width: 100%;
    border-radius: var(--weeb-radius, 8px);
    background: transparent;
    text-decoration: none;
    color: inherit;
    transition: background 0.15s ease;
  }
  .rail-item:hover,
  .rail-item.is-active {
    background: var(--weeb-surface-hover);
  }
  .rail-item:focus-visible {
    outline: 2px solid var(--weeb-accent-text);
    outline-offset: 2px;
  }

  .rail-art {
    flex: 0 0 auto;
    aspect-ratio: 2 / 3;
    border-radius: var(--weeb-radius-sm, 4px);
    overflow: hidden;
    background: var(--weeb-surface);
  }
  .rail-art :global(.rail-art-img),
  .rail-art :global(.rail-art-img img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .rail-body {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    justify-content: center;
  }
  .rail-name {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--weeb-fg);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rail-line {
    display: flex;
    gap: 8px;
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    letter-spacing: 0.02em;
    color: var(--weeb-fg-secondary);
    white-space: nowrap;
  }
  .rail-local { color: var(--weeb-fg-secondary); }

  .rail-when {
    /* Fixed, not content-sized. The whole point is that every row gives its
       title the same width, so titles truncate at one place down the list
       instead of wherever that row's countdown happened to end. 8ch covers the
       longest form ("15m left") in this monospace face. */
    flex: 0 0 auto;
    min-width: 8ch;
    justify-content: flex-end;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--weeb-fg);
    white-space: nowrap;
  }
  .rail-when.is-live { color: var(--weeb-green); }
  .rail-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--weeb-green);
    animation: railPulse 2s infinite;
  }
  @keyframes railPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  @media (prefers-reduced-motion: reduce) {
    .rail-dot { animation: none; }
    .rail-item { transition: none; }
  }

  /* ---- Desktop: vertical panel on the right of the banner ---- */
  @media (min-width: 1025px) {
    .rail {
      right: var(--weeb-section-px, 48px);
      bottom: calc(48px + var(--hero-fade, 0px));
      width: 340px;
      padding: 14px;
    }
    .rail-head { margin-bottom: 10px; }
    .rail-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .rail-item {
      align-items: center;
      padding: 6px;
    }
    .rail-art { width: 34px; }
    /* Panel height is the constraint here, not data. The tray shows all eight. */
    .rail-list li:nth-child(n + 7) { display: none; }
    .rail-when { align-self: center; }
  }

  /* ---- Mobile: full-width tray across the base of the banner ----
     Horizontal scroll rather than a wrapped grid, per DESIGN.md: a row of
     schedule entries reads as one continuous shelf at every size. */
  @media (max-width: 1024px) {
    .rail {
      left: 16px;
      right: 16px;
      bottom: calc(16px + var(--hero-fade, 0px));
      padding: 12px 0 12px 12px;
    }
    .rail-head {
      padding-right: 12px;
      margin-bottom: 10px;
    }
    .rail-list {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      padding-right: 12px;
      /* Momentum scrolling shouldn't clip the focus ring on the first card. */
      scroll-padding-left: 12px;
    }
    .rail-list li {
      flex: 0 0 auto;
      scroll-snap-align: start;
    }
    /* Two rows beside the art rather than three columns: at 208px there is no
       room for a right-hand countdown column, and the countdown is the one
       value that must not be the thing that gets dropped. */
    .rail-item {
      display: grid;
      grid-template-columns: 38px 1fr;
      grid-template-rows: auto auto;
      column-gap: 10px;
      row-gap: 3px;
      align-items: center;
      width: 208px;
      padding: 6px;
    }
    .rail-art {
      grid-row: 1 / 3;
      width: 38px;
    }
    .rail-body { grid-column: 2; gap: 2px; }
    .rail-when { grid-column: 2; }
  }
</style>
