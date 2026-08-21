<script lang="ts">
  import { format, isDate } from 'date-fns';
  import { createEventDispatcher } from 'svelte';

  export let episodes: any[];
  /** How many episodes the viewer has watched. Progress is a single integer, so
   *  "episode N is watched" is exactly `watchedCount >= N`. */
  export let watchedCount: number = 0;
  /** False when the show is not on the viewer's list. The control is then absent
   *  rather than disabled: a dead button teaches nothing, and the page already
   *  had two of them. */
  export let canTrack: boolean = false;
  export let pending: boolean = false;

  const dispatch = createEventDispatcher<{ watch: { episodes: number } }>();

  /** Rendered before the reader asks for more. A 500-episode show shipped every
   *  row into the SSR payload -- 796KB for Naruto, 960KB for Bleach -- on a
   *  product whose third principle is that fast beats rich. */
  const INITIAL_ROWS = 24;

  let expanded = false;
  /** Newest first by default: the recurring question is "did the latest one
   *  drop", not "what was episode 1". Ascending is one click away for anyone
   *  starting a show, which is the other real reading order. */
  let newestFirst = true;

  $: ordered = episodes
    ? [...episodes].sort((a, b) =>
        newestFirst ? b.episodeNumber - a.episodeNumber : a.episodeNumber - b.episodeNumber
      )
    : [];

  $: visible = expanded ? ordered : ordered.slice(0, INITIAL_ROWS);
  $: hiddenCount = ordered.length - visible.length;

  function airDateOf(episode: any): Date | null {
    if (!episode?.airDate) return null;
    const d = new Date(episode.airDate);
    return isDate(d) && !Number.isNaN(d.getTime()) ? d : null;
  }

  function isAired(episode: any): boolean {
    const d = airDateOf(episode);
    return d ? d < new Date() : false;
  }

  /** The first episode that has not aired. It is the one the whole page is
   *  about, and it used to be distinguishable only by 0.5 opacity on a 13px
   *  numeral. */
  $: nextUp = episodes
    ? [...episodes]
        .filter(e => !isAired(e))
        .sort((a, b) => a.episodeNumber - b.episodeNumber)[0]
    : undefined;

  function label(episode: any): string {
    const d = airDateOf(episode);
    if (!d) return 'TBA';
    // The next episode carries a local time; the rest only need a date. Times are
    // rendered in the viewer's zone, which is the whole point of storing them.
    return nextUp && episode.id === nextUp.id
      ? format(d, 'd MMM, h:mm a')
      : format(d, 'd MMM yyyy');
  }

  function isWatched(episode: any): boolean {
    return watchedCount >= episode.episodeNumber;
  }

  function toggle(episode: any) {
    if (!canTrack || pending) return;
    // Marking N watched means "I am up to N". Un-marking means "I am up to N-1",
    // which is what a single-integer progress model can honestly represent.
    dispatch('watch', { episodes: isWatched(episode) ? episode.episodeNumber - 1 : episode.episodeNumber });
  }
</script>

<div class="ep-section">
  <div class="ep-toolbar">
    <span class="ep-count">
      {ordered.length}
      {ordered.length === 1 ? 'episode' : 'episodes'}{#if canTrack} &middot; {watchedCount} watched{/if}
    </span>
    <button
      type="button"
      class="ep-sort"
      aria-pressed={newestFirst}
      on:click={() => (newestFirst = !newestFirst)}
    >
      {newestFirst ? 'Newest first' : 'Oldest first'}
    </button>
  </div>

  <ol class="ep-list">
    {#each visible as episode (episode.id)}
      {@const watched = isWatched(episode)}
      {@const next = nextUp && episode.id === nextUp.id}
      <li
        class="ep-row"
        class:ep-row--future={!isAired(episode)}
        class:ep-row--watched={watched}
        class:ep-row--next={next}
      >
        <span class="ep-num">{episode.episodeNumber}</span>

        <span class="ep-info">
          <span class="ep-title">{episode.titleEn || 'TBA'}</span>
          {#if episode.titleJp && episode.titleJp !== episode.titleEn}
            <span class="ep-sub">{episode.titleJp}</span>
          {/if}
        </span>

        <span class="ep-date">
          {#if next}<span class="ep-next-dot" aria-hidden="true"></span>{/if}{label(episode)}
        </span>

        {#if canTrack}
          <button
            type="button"
            class="ep-watch"
            class:is-on={watched}
            disabled={pending}
            aria-pressed={watched}
            aria-label={watched
              ? `Mark episode ${episode.episodeNumber} unwatched`
              : `Mark episode ${episode.episodeNumber} watched`}
            on:click={() => toggle(episode)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" stroke-width="2.2"
                    stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        {/if}
      </li>
    {/each}
  </ol>

  {#if hiddenCount > 0}
    <button type="button" class="ep-more" on:click={() => (expanded = true)}>
      Show all {ordered.length} episodes
    </button>
  {/if}
</div>

<style>
  .ep-section {
    margin-bottom: 0;
  }

  .ep-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }
  .ep-count {
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    color: var(--weeb-fg-muted);
  }
  .ep-sort {
    min-height: 44px;
    padding: 0 12px;
    background: none;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    font-family: var(--weeb-font);
    font-size: 12px;
    font-weight: 600;
    color: var(--weeb-fg-secondary);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .ep-sort:hover {
    color: var(--weeb-fg);
    background: var(--weeb-surface);
  }

  /* No max-height. The list used to live in its own 520px scroller, which put
     500 episodes into a 67:1 nested box and buried the newest 34,000px down an
     inner scrollbar. Content scrolls with the page. */
  .ep-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    overflow: hidden;
  }

  .ep-row {
    display: grid;
    grid-template-columns: 48px 1fr 132px;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--weeb-border);
  }
  /* The row itself is not interactive and no longer pretends to be: it carried
     cursor:pointer and a hover background with no handler, href, role or
     tabindex on every one of 500 rows. */
  .ep-row:last-child {
    border-bottom: none;
  }
  .ep-row--watched {
    background: color-mix(in oklch, var(--weeb-accent) 7%, transparent);
  }
  .ep-row--next {
    background: color-mix(in oklch, var(--weeb-green) 8%, transparent);
  }

  .ep-num {
    font-family: var(--weeb-font-mono);
    font-size: 13px;
    font-weight: 700;
    color: var(--weeb-accent-text);
  }
  .ep-row--future .ep-num {
    color: var(--weeb-fg-muted);
  }

  .ep-info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  /* Wraps to two lines. Nowrap ellipsis produced six consecutive rows reading
     "The Frontier Lord and the ..." -- identical, and so useless for telling
     episodes apart, which is the column's only job. */
  .ep-title {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.35;
    color: var(--weeb-fg);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .ep-row--future .ep-title {
    color: var(--weeb-fg-secondary);
  }
  .ep-sub {
    font-size: 12px;
    color: var(--weeb-fg-muted);
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .ep-date {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    color: var(--weeb-fg-muted);
    text-align: right;
  }
  .ep-row--next .ep-date {
    color: var(--weeb-fg-secondary);
  }
  .ep-next-dot {
    width: 6px;
    height: 6px;
    border-radius: var(--weeb-radius-full, 9999px);
    background: var(--weeb-green);
    flex: none;
  }

  .ep-watch {
    width: 44px;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-full, 9999px);
    color: var(--weeb-fg-muted);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .ep-watch svg {
    width: 18px;
    height: 18px;
  }
  .ep-watch:hover:not(:disabled) {
    color: var(--weeb-fg);
    border-color: var(--weeb-fg-secondary);
  }
  .ep-watch.is-on {
    color: white;
    background: var(--weeb-accent);
    border-color: var(--weeb-accent);
  }
  .ep-watch:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .ep-more {
    width: 100%;
    min-height: 44px;
    margin-top: 10px;
    background: none;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    font-family: var(--weeb-font);
    font-size: 14px;
    font-weight: 600;
    color: var(--weeb-fg-secondary);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }
  .ep-more:hover {
    color: var(--weeb-fg);
    background: var(--weeb-surface);
  }

  @media (prefers-reduced-motion: reduce) {
    .ep-sort,
    .ep-watch,
    .ep-more {
      transition: none;
    }
  }

  @media (max-width: 480px) {
    .ep-row {
      grid-template-columns: 32px 1fr auto;
      gap: 10px;
      padding: 10px 12px;
    }
    .ep-num {
      font-size: 12px;
    }
    .ep-title {
      font-size: 13px;
    }
    .ep-date {
      /* Under the title on a phone rather than a third column: at 320px of
         usable width a 132px date column left the title 120px. */
      grid-column: 2;
      grid-row: 2;
      justify-content: flex-start;
    }
    .ep-watch {
      grid-column: 3;
      grid-row: 1 / span 2;
    }
  }
</style>
