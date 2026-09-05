<script lang="ts">
  import Tabs from './Tabs.svelte';
  import Skeleton from './Skeleton.svelte';
  import EmptyState from './EmptyState.svelte';
  import ErrorBanner from './ErrorBanner.svelte';
  import AnimeCalendarPopover from './AnimeCalendarPopover.svelte';
  import { AiringCalendarBloc } from './AiringCalendar.bloc.svelte';
  import type { AiringShow } from './CurrentlyAiringPage.schedule';
  import type { TabItem } from './Tabs.svelte';

  /**
   * The airing schedule as a month or week grid.
   *
   * A view over the bloc: it owns the range, the query keyed to it and the
   * per-day bucketing; this renders cells.
   */
  let {
    ssrData = null,
    ssrError = null,
    bloc = new AiringCalendarBloc({ source: () => ({ ssrData, ssrError }) }),
  }: {
    ssrData?: { currentlyAiring?: AiringShow[] | null } | null;
    ssrError?: string | null;
    /** Kept for the loader's call site; the page reacts to it, nothing else does. */
    isTokenExpired?: boolean;
    bloc?: AiringCalendarBloc;
  } = $props();

  $effect(() => bloc.init());

  const MODES: TabItem[] = [
    { value: 'month', label: 'Month' },
    { value: 'week', label: 'Week' },
  ];

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const GRID =
    'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-px bg-weeb-surface ' +
    'border border-weeb-border rounded-lg overflow-hidden text-sm relative z-0 ' +
    'transition-colors duration-300';

  const CELL =
    'bg-weeb-surface p-2 transition-colors duration-300 flex flex-col justify-start ' +
    'border border-weeb-border';

  /**
   * A placeholder month should look like a month that has shows in it, not like
   * an empty one, or the grid visibly reflows when the data lands. The counts
   * are a fixed pattern rather than nine hand-copied cells: same shape, one
   * place to change it.
   */
  function placeholderRows(index: number): number {
    return [1, 2, 3, 1, 4, 1, 1][index % 7];
  }
</script>

<div class="max-w-screen-xl mx-auto relative py-8 px-0">
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
    <Tabs
      items={MODES}
      value={bloc.viewMode}
      onChange={(value) => bloc.selectViewMode(value)}
      variant="segmented"
      ariaLabel="Month or week"
    />

    <div class="flex items-center gap-4">
      <button
        type="button"
        onclick={() => bloc.previous()}
        class="text-sm text-weeb-accent-text hover:underline transition-colors duration-300"
      >
        ← Previous
      </button>
      <h1 class="text-xl font-bold text-weeb-fg">{bloc.title}</h1>
      <button
        type="button"
        onclick={() => bloc.next()}
        class="text-sm text-weeb-accent-text hover:underline transition-colors duration-300"
      >
        Next →
      </button>
    </div>
  </div>

  {#if bloc.isError}
    <ErrorBanner
      message="Couldn't load the airing calendar."
      detail={bloc.errorDetail}
      retrying={bloc.isRetrying}
      onRetry={() => bloc.retry()}
    />
  {:else if bloc.isLoading}
    <div class={GRID}>
      {#each WEEKDAYS as weekday (weekday)}
        <div
          class="hidden lg:block bg-weeb-bg-elevated py-2 px-2 text-center font-medium text-weeb-fg-secondary border-b border-weeb-border transition-colors duration-300"
        >
          {weekday}
        </div>
      {/each}

      {#each Array(bloc.skeletonCellCount) as _, index (index)}
        <div class="{CELL} min-h-[140px]">
          <div class="text-xs font-semibold text-weeb-fg mb-1 flex items-center gap-1">
            <Skeleton className="h-3 w-4" />
          </div>
          <div class="flex flex-col gap-1 pr-1">
            {#each Array(placeholderRows(index)) as _, row (row)}
              <div class="bg-weeb-surface px-2 py-1 rounded w-full flex flex-col gap-0.5">
                <Skeleton className="h-[14px] w-full bg-weeb-surface-hover" />
                <Skeleton className="h-[10px] w-12 bg-weeb-surface-hover" />
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {:else if bloc.isEmpty}
    <EmptyState
      variant="panel"
      heading="Nothing airing"
      message={bloc.isMonthView
        ? 'No episodes are scheduled for this month.'
        : 'No episodes are scheduled for this week.'}
    />
  {:else}
    <div class={GRID}>
      {#each WEEKDAYS as weekday (weekday)}
        <div
          class="hidden lg:block bg-weeb-bg-elevated py-2 px-2 text-center font-medium text-weeb-fg-secondary border-b border-weeb-border transition-colors duration-300"
        >
          {weekday}
        </div>
      {/each}

      {#each bloc.cells as cell (cell.iso)}
        <div
          class="{CELL} {bloc.isMonthView ? 'min-h-[140px]' : ''} {cell.isToday
            ? 'ring-2 ring-weeb-accent'
            : ''}"
        >
          <div class="text-xs font-semibold text-weeb-fg mb-1 flex items-center gap-1">
            <span>{cell.dayNumber}</span>
            <span class="text-weeb-fg-muted text-xs block lg:hidden">({cell.weekdayShort})</span>
          </div>
          <div
            class="flex flex-col gap-1 pr-1 {bloc.isMonthView
              ? 'overflow-y-auto scrollbar-thin scrollbar-thumb-weeb-border scrollbar-track-transparent'
              : ''}"
          >
            {#each cell.entries as anime, index (`${anime.id}-${index}`)}
              <AnimeCalendarPopover {anime} />
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
