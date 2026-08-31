<script lang="ts">
  import { format, isDate } from 'date-fns';
  import { createEventDispatcher, tick } from 'svelte';

  export let episodes: any[];
  /**
   * How many episodes the viewer has watched, as the aggregate on their list
   * entry. Only a fallback now: it can express "up to N" and nothing else, so
   * watchedNumbers wins wherever it is available.
   */
  export let watchedCount: number = 0;
  /**
   * Episode numbers the viewer has actually finished.
   *
   * Null means the caller has no per-episode data -- signed out, or still
   * loading -- and the component falls back to watchedCount. That fallback is
   * what keeps the list honest during the moment before the query resolves,
   * rather than showing every episode unwatched and inviting a click that
   * un-marks something.
   */
  export let watchedNumbers: Set<number> | null = null;
  /** False when the show is not on the viewer's list. The control is then absent
   *  rather than disabled: a dead button teaches nothing, and the page already
   *  had two of them. */
  export let canTrack: boolean = false;
  export let pending: boolean = false;

  const dispatch = createEventDispatcher<{
    watch: { episodeNumber: number; watched: boolean };
  }>();

  /** Rendered before the reader asks for more. A 500-episode show shipped every
   *  row into the SSR payload -- 796KB for Naruto, 960KB for Bleach -- on a
   *  product whose third principle is that fast beats rich. */
  const INITIAL_ROWS = 24;

  let expanded = false;
  /** The list's own top. Collapsing 136 rows removes ~15,000px from above the
   *  viewport, so without this the reader is returned to the footer of a page
   *  they were reading the middle of. */
  let listTop: HTMLElement;
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

  /**
   * Whether one episode is watched.
   *
   * The state is passed in rather than read from the component's own scope, so
   * that the template's `{@const watched = isWatched(...)}` actually depends on
   * it. Svelte tracks the values a template expression *references*; anything a
   * called function closes over is invisible to it. Reading watchedNumbers
   * inside here left the ticks frozen at whatever they were when the rows first
   * rendered -- the query resolved, the data was correct, and the list never
   * repainted.
   */
  function isWatched(episode: any, numbers: Set<number> | null, count: number): boolean {
    // Per-episode when we have it. The count is a fallback for the moment
    // before that query resolves, and it can only express "up to N" -- which is
    // exactly the limitation this replaces.
    if (numbers) return numbers.has(episode.episodeNumber);

    return count >= episode.episodeNumber;
  }

  function toggle(episode: any) {
    if (!canTrack || pending) return;
    // The episode itself, not a new high-water mark. Watching 1, 2 and 5 is a
    // thing people do, and the old model could only say "up to 5" -- which
    // silently claimed 3 and 4 as well.
    dispatch('watch', {
      episodeNumber: episode.episodeNumber,
      watched: !isWatched(episode, watchedNumbers, watchedCount),
    });
  }

  async function collapse() {
    expanded = false;
    // After the rows are gone, not before: scrolling into the old layout lands
    // the reader at an offset the shrinking document immediately clamps away,
    // which measured as the list toolbar sitting under the sticky tab bar.
    await tick();
    // Anchor to the list rather than the document: the reader asked for less
    // list, not for the top of the page.
    listTop?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
</script>

<div class="ep-section" bind:this={listTop}>
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

  <ol class="ep-list" class:ep-list--trackable={canTrack}>
    {#each visible as episode (episode.id)}
      {@const watched = isWatched(episode, watchedNumbers, watchedCount)}
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
  {:else if expanded}
    <button type="button" class="ep-more" on:click={collapse}>
      Show fewer
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

  /* No max-height: the list used to live in its own 520px scroller, which put
     500 episodes into a 67:1 nested box and buried the newest 34,000px down an
     inner scrollbar. Content scrolls with the page.

     Dividers are per-cell borders on the leading edges, pulled back over the
     preceding cell by a matching negative margin. Three properties fall out of
     that and all three matter here: the borders never occupy layout space, the
     first row's and first column's borders land outside the padding box and are
     clipped by overflow:hidden so the container's own 1px frame is not doubled,
     and a cell that does not exist draws nothing -- so a partial final row is
     simply the container's background rather than a lighter block. Gap-drawn
     hairlines get the first two but not the third, and there is no CSS that
     spans a filler across an unknown remainder. */
  .ep-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    background: var(--weeb-bg-elevated);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    overflow: hidden;
  }

  /* Episodes are a list that tiles, so width becomes more of them rather than
     wider ones. At 2,526px a single column put the episode number's right edge
     at x=117 and its date at x=2,317 -- a 2,200px saccade across an empty row
     to read two things about one episode. */
  @media (min-width: 1400px) {
    .ep-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (min-width: 2000px) {
    .ep-list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .ep-row {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) 132px;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    /* Opaque, so a row never lets the row it overlaps show through. */
    background: var(--weeb-bg-elevated);
    border-left: 1px solid var(--weeb-border);
    border-top: 1px solid var(--weeb-border);
    margin: -1px 0 0 -1px;
  }
  /* A fourth column for the watch button, only when it is rendered.
     The row has four children when canTrack, but the grid declared three, so
     the button had no column and wrapped onto an implicit second row --
     stranded under the episode number with the row grown to fit it. It looked
     correct on a phone only because the narrow layout below places both the
     date and the button explicitly.
     Scoped to the container class rather than added unconditionally: signed
     out there is no button, and a fourth column would leave its width and gap
     as dead space on the right of every row. */
  .ep-list--trackable .ep-row {
    grid-template-columns: 48px minmax(0, 1fr) 132px 44px;
  }

  /* The row itself is not interactive and no longer pretends to be: it carried
     cursor:pointer and a hover background with no handler, href, role or
     tabindex on every one of 500 rows. */
  .ep-row--watched {
    background: color-mix(in oklch, var(--weeb-accent) 7%, var(--weeb-bg-elevated));
  }
  .ep-row--next {
    background: color-mix(in oklch, var(--weeb-green) 8%, var(--weeb-bg-elevated));
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
    /* Bounded and centred rather than full-bleed: a 2,422px-wide button is the
       same void this list was just taught not to leave. */
    width: 100%;
    max-width: 420px;
    min-height: 44px;
    margin: 10px auto 0;
    display: block;
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
    .ep-row,
    /* Same specificity as the desktop rule above, which is a two-class
       selector; a bare .ep-row here would lose to it and take the phone layout
       back to four columns. */
    .ep-list--trackable .ep-row {
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
