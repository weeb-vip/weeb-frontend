<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import StructuredData from '$lib/StructuredData.svelte';
  import { itemListSchema, breadcrumbSchema } from '$lib/structured-data';
  import Tabs from '../../svelte/components/Tabs.svelte';
  import EmptyState from '../../svelte/components/EmptyState.svelte';
  import ErrorBanner from '../../svelte/components/ErrorBanner.svelte';
  import Skeleton from '../../svelte/components/Skeleton.svelte';
  import { CurrentlyAiringPageBloc } from '../../svelte/components/CurrentlyAiringPage.bloc.svelte';
  import type { AiringShow } from '../../svelte/components/CurrentlyAiringPage.schedule';
  import type { TabItem } from '../../svelte/components/Tabs.svelte';

  /**
   * What is airing, as a forward-looking schedule or as a month calendar.
   *
   * A view over the bloc: it owns the date ranges, the buckets, the grid, the
   * timezone and the filters; this renders them. Notably the view switch and
   * the my-list filter are plain reactive state now -- they used to be
   * implemented by querying the document and assigning `style.display`.
   */
  let {
    data,
    bloc = new CurrentlyAiringPageBloc({ source: () => ({ ssrData: data.ssrData ?? null }) }),
  }: {
    data: { ssrData?: { currentlyAiring?: AiringShow[] | null } | null };
    bloc?: CurrentlyAiringPageBloc;
  } = $props();

  $effect(() => bloc.init());

  const SITE_URL = 'https://weeb.vip';

  const canonical = `${SITE_URL}/airing`;
  const schemas = $derived([
    itemListSchema(data.ssrData?.currentlyAiring, {
      name: 'Currently Airing Anime',
      url: canonical,
      siteUrl: SITE_URL
    }),
    breadcrumbSchema([
      { name: 'Home', url: `${SITE_URL}/` },
      { name: 'Currently Airing', url: canonical }
    ])
  ]);

  const VIEWS: TabItem[] = [
    { value: 'schedule', label: 'Schedule' },
    { value: 'calendar', label: 'Calendar' },
  ];

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  /** The dot colours cycle so a busy day reads as more than one show at a glance. */
  const DOT_TONES = ['accent', 'violet', 'green', 'amber'];
</script>

<Seo
  title="Currently Airing Anime"
  description="Discover what anime is currently airing this season. Get episode schedules, notifications, and add shows to your watchlist."
/>

<StructuredData {schemas} />

{#snippet viewIcon(item: TabItem)}
  <span class="tab-svg" aria-hidden="true">
    {#if item.value === 'schedule'}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
    {:else}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    {/if}
  </span>
{/snippet}

<div class="airing-page">
  <div class="page-header">
    <div class="page-header-inner">
      <div class="page-header-left">
        <div class="page-header-eyebrow">
          <div class="live-dot"></div>
          <span class="label">{bloc.seasonLabel}</span>
        </div>
        <h1 class="page-title">Currently Airing</h1>
      </div>

      <div class="page-header-controls">
        <Tabs
          items={VIEWS}
          value={bloc.view}
          onChange={(value) => bloc.selectView(value)}
          variant="segmented"
          ariaLabel="Schedule or calendar"
          itemContent={viewIcon}
        />

        <select
          class="tz-select"
          value={bloc.timezone}
          onchange={(event) => bloc.selectTimezone(event.currentTarget.value)}
          aria-label="Timezone"
        >
          {#each bloc.timezones as tz (tz.value)}
            <option value={tz.value}>{tz.label}</option>
          {/each}
        </select>

        <button
          type="button"
          class="toggle-wrap"
          class:on={bloc.myListOnly}
          onclick={() => bloc.toggleMyListOnly()}
          role="switch"
          aria-checked={bloc.myListOnly}
        >
          <span class="toggle-switch"></span>
          My list only
        </button>
      </div>
    </div>
  </div>

  {#if bloc.isError}
    <!-- A failed fetch is not an empty schedule: something is airing, we just
         could not ask. -->
    <div class="airing-error">
      <ErrorBanner
        message="Couldn't load the airing schedule."
        detail={bloc.errorDetail}
        retrying={bloc.isRetrying}
        onRetry={() => bloc.retry()}
      />
    </div>
  {:else if bloc.view === 'schedule'}
    <div class="schedule-view">
      {#if bloc.isLoading}
        {#each Array(3) as _, dayIndex (dayIndex)}
          <div class="day-section">
            <div class="day-section-header">
              <Skeleton className="h-4 w-32" />
            </div>
            <div class="day-cards">
              {#each Array(4) as _, cardIndex (cardIndex)}
                <div class="show-card is-skeleton">
                  <Skeleton className="w-[50px] h-[70px] shrink-0" />
                  <div class="show-info">
                    <Skeleton className="h-3.5 w-4/5" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      {:else if bloc.isFilteredOut}
        <EmptyState
          heading="Nothing from your list"
          message="No anime from your list are airing in this period."
          action={{ label: 'Show all anime', onClick: () => bloc.showAllAnime(), variant: 'ghost' }}
        />
      {:else if bloc.scheduleDays.length === 0}
        <EmptyState heading="Nothing scheduled" message="No upcoming airing anime found." />
      {:else}
        {#each bloc.scheduleDays as group (group.id)}
          {@const collapsed = bloc.isCollapsed(group.id)}
          <div class="day-section" class:collapsed data-day-group={group.id}>
            <button
              type="button"
              class="day-section-header"
              onclick={() => bloc.toggleDay(group.id)}
              aria-expanded={!collapsed}
            >
              <span class="day-name">{group.dayName}</span>
              <span class="day-date">{group.date}</span>
              {#if group.isToday}
                <span class="day-today-badge">
                  <span class="live-dot" style="width:6px;height:6px;"></span>
                  Today
                </span>
              {/if}
              <span class="day-count">
                {group.entries.length} show{group.entries.length === 1 ? '' : 's'}
              </span>
              <svg class="day-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>

            {#if !collapsed}
              <div class="day-cards">
                {#each group.entries as entry (entry.id)}
                  {@const countdown = bloc.countdownFor(entry)}
                  {@const title = bloc.titleFor(entry)}
                  <a
                    href={bloc.hrefFor(entry)}
                    class="show-card"
                    data-anime-id={entry.airingInfo.id}
                    onclick={(event) => {
                      event.preventDefault();
                      bloc.open(entry);
                    }}
                  >
                    <div class="show-poster">
                      <img
                        src={bloc.imageFor(entry, 160)}
                        alt={title}
                        loading="lazy"
                        onerror={(event) => {
                          (event.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div class="show-info">
                      <div class="show-title">{title}</div>
                      <div class="show-meta-row">
                        <span class="show-ep">{bloc.episodeFor(entry)}</span>
                        <span class="show-time">{bloc.timeFor(entry)}</span>
                      </div>
                      <span class="show-countdown {countdown.status}">
                        {#if countdown.status === 'airing-now'}
                          <span class="airing-now-dot"></span>
                        {/if}
                        {countdown.text}
                      </span>
                    </div>
                    {#if !bloc.isOnList(entry)}
                      <button
                        type="button"
                        class="show-add-btn"
                        title="Add to list"
                        aria-label="Add to list"
                        onclick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          bloc.addToList(entry);
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    {/if}
                  </a>
                {/each}
              </div>
            {/if}
          </div>
        {/each}

        {#if bloc.hasMoreDays}
          <button type="button" class="load-more-btn" onclick={() => bloc.showMoreDays()}>
            Show next {bloc.nextDayBatch} day{bloc.nextDayBatch === 1 ? '' : 's'}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        {/if}
      {/if}
    </div>
  {:else}
    <div class="calendar-view">
      <div class="calendar-layout">
        <div class="calendar-card" class:loading={bloc.calendarLoading}>
          <div class="calendar-nav">
            <button
              type="button"
              class="cal-nav-btn"
              onclick={() => bloc.previousMonth()}
              aria-label="Previous month"
              disabled={bloc.calendarLoading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span class="calendar-month-label">
              {bloc.monthLabel}
              {#if bloc.calendarLoading}
                <span class="cal-loading-dot"></span>
              {/if}
            </span>
            <button
              type="button"
              class="cal-nav-btn"
              onclick={() => bloc.nextMonth()}
              aria-label="Next month"
              disabled={bloc.calendarLoading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>

          <div class="calendar-weekdays">
            {#each WEEKDAYS as weekday (weekday)}
              <div class="cal-weekday">{weekday}</div>
            {/each}
          </div>

          <div class="calendar-days">
            {#if bloc.isLoading}
              <!-- Six weeks of empty squares: the grid keeps its full height, so
                   the month does not jump when the data lands. -->
              {#each Array(42) as _, cell (cell)}
                <div class="cal-day is-skeleton">
                  <Skeleton className="h-7 w-7 rounded-full" />
                </div>
              {/each}
            {:else}
              {#each bloc.calendarDays as day (day.iso)}
                <button
                  type="button"
                  class="cal-day"
                  class:other-month={day.otherMonth}
                  class:today={day.isToday}
                  class:selected={bloc.selectedDay === day.iso}
                  onclick={() => bloc.selectDay(day.iso)}
                  aria-pressed={bloc.selectedDay === day.iso}
                >
                  <div class="cal-day-num">{day.num}</div>
                  {#if day.showCount > 0}
                    <div class="cal-dots">
                      {#each Array(Math.min(day.showCount, 5)) as _, dot (dot)}
                        <div class="cal-dot cal-dot-{DOT_TONES[dot % DOT_TONES.length]}"></div>
                      {/each}
                    </div>
                    <span class="cal-show-count">{day.showCount}</span>
                  {/if}
                </button>
              {/each}
            {/if}
          </div>
        </div>

        <div class="cal-side-panel">
          <div class="cal-panel-header">
            <span class="cal-panel-label">Selected Day</span>
            <span class="cal-panel-date">{bloc.selectedDayLabel}</span>
          </div>
          {#if !bloc.selectedDay}
            <EmptyState size="compact" message="Select a day to see airing shows" />
          {:else if bloc.selectedDayEntries.length === 0}
            <EmptyState
              size="compact"
              message={bloc.emptyDayMessage}
              action={bloc.myListOnly
                ? { label: 'Show all anime', onClick: () => bloc.showAllAnime(), variant: 'ghost' }
                : undefined}
            />
          {:else}
            <div class="cal-panel-shows">
              {#each bloc.selectedDayEntries as entry (entry.id)}
                {@const title = bloc.titleFor(entry)}
                <a
                  href={bloc.hrefFor(entry)}
                  class="cal-show-item"
                  onclick={(event) => {
                    event.preventDefault();
                    bloc.open(entry);
                  }}
                >
                  <div class="cal-show-poster">
                    <img
                      src={bloc.imageFor(entry, 160)}
                      alt={title}
                      loading="lazy"
                      onerror={(event) => {
                        (event.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div class="cal-show-info">
                    <div class="cal-show-title">{title}</div>
                    <div class="cal-show-meta">
                      <span class="cal-ep">{bloc.episodeFor(entry)}</span>
                      <span class="cal-time">{bloc.timeFor(entry)}</span>
                    </div>
                  </div>
                </a>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ---- Layout ---- */
  .airing-page {
    max-width: 100%;
    margin: 0 auto;
    padding: 0 var(--weeb-section-px, 48px);
  }

  /* ---- Page Header ---- */
  .page-header {
    padding: 40px 0 24px;
    border-bottom: 1px solid var(--weeb-border);
  }
  .page-header-inner {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
  }
  .page-header-left {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .page-header-eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--weeb-green);
    box-shadow: 0 0 0 0 oklch(65% 0.15 155 / 0.4);
    animation: pulse-dot 2s infinite;
  }
  @keyframes pulse-dot {
    0%   { box-shadow: 0 0 0 0 oklch(65% 0.15 155 / 0.4); }
    70%  { box-shadow: 0 0 0 8px oklch(65% 0.15 155 / 0); }
    100% { box-shadow: 0 0 0 0 oklch(65% 0.15 155 / 0); }
  }
  .label {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 600;
    font-family: var(--weeb-font-mono);
    color: var(--weeb-accent-text);
  }
  .page-title {
    font-size: clamp(1.75rem, 3vw, 2.5rem);
    line-height: 1.1;
    letter-spacing: -0.025em;
    font-weight: 700;
    color: var(--weeb-fg);
    margin: 0;
  }
  .page-header-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  /* The view switch is Tabs in its segmented skin; only the inline icon needs
     saying here. */
  .tab-svg { display: inline-flex; }

  /* ---- Timezone Select ---- */
  .tz-select {
    height: 34px;
    padding: 0 30px 0 10px;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    background: var(--weeb-surface);
    color: var(--weeb-fg-secondary);
    font-size: 13px;
    font-family: var(--weeb-font-mono);
    font-variant-numeric: tabular-nums;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .tz-select:focus { outline: none; border-color: var(--weeb-accent); }

  /* ---- My List Toggle ---- */
  .toggle-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-family: inherit;
    color: var(--weeb-fg-muted);
    cursor: pointer;
    user-select: none;
    padding: 4px 0;
    background: none;
    border: none;
  }
  .toggle-wrap:hover { color: var(--weeb-fg-secondary); }
  .toggle-switch {
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    position: relative;
    transition: background 0.2s, border-color 0.2s;
    flex-shrink: 0;
  }
  .toggle-switch::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--weeb-fg-muted);
    top: 1px;
    left: 1px;
    transition: transform 0.2s, background 0.2s;
  }
  .toggle-wrap.on .toggle-switch { background: var(--weeb-accent); border-color: var(--weeb-accent); }
  .toggle-wrap.on .toggle-switch::after { transform: translateX(16px); background: white; }

  /* ---- Views ---- */
  .airing-error { padding: 32px 0; }
  .schedule-view { padding: 32px 0 64px; }

  /* ---- Day Section ---- */
  .day-section { margin-bottom: 32px; }
  .day-section:last-child { margin-bottom: 0; }

  .day-section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    margin-bottom: 12px;
    padding: 0 0 8px;
    border: none;
    border-bottom: 1px solid var(--weeb-border);
    background: none;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    user-select: none;
  }
  .day-section-header:hover .day-name { color: var(--weeb-accent-hover, var(--weeb-accent)); }
  .day-section-header:focus-visible {
    outline: 2px solid var(--weeb-accent);
    outline-offset: 2px;
  }
  .day-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--weeb-fg);
    transition: color 0.15s;
  }
  .day-date {
    font-size: 13px;
    color: var(--weeb-fg-muted);
    font-family: var(--weeb-font-mono);
    font-variant-numeric: tabular-nums;
  }
  .day-today-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 8px;
    border-radius: 11px;
    background: var(--weeb-green);
    color: oklch(18% 0.02 155);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
  .day-count {
    font-size: 12px;
    color: var(--weeb-fg-muted);
    margin-left: auto;
  }
  .day-chevron {
    color: var(--weeb-fg-muted);
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  .collapsed .day-chevron { transform: rotate(-90deg); }

  /* ---- Horizontal Show Cards ---- */
  .day-cards {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 4px;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
  }
  .day-cards::-webkit-scrollbar { height: 4px; }
  .day-cards::-webkit-scrollbar-track { background: transparent; }
  .day-cards::-webkit-scrollbar-thumb { background: var(--weeb-border); border-radius: 2px; }

  .show-card {
    position: relative;
    flex-shrink: 0;
    width: 320px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    transition: background 0.15s, border-color 0.15s, transform 0.15s;
    scroll-snap-align: start;
    text-decoration: none;
    color: inherit;
    overflow: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .show-card::-webkit-scrollbar { display: none; }
  .show-card:hover {
    background: var(--weeb-surface-hover);
    border-color: oklch(34% 0.02 275);
    transform: translateY(-1px);
  }
  /* A placeholder is not hoverable and should not pretend otherwise. */
  .show-card.is-skeleton {
    opacity: 0.6;
    pointer-events: none;
  }

  .show-poster {
    width: 50px;
    height: 70px;
    border-radius: var(--weeb-radius);
    flex-shrink: 0;
    overflow: hidden;
    background: var(--weeb-bg-elevated);
  }
  .show-poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .show-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .show-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--weeb-fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }
  .show-meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .show-ep {
    font-size: 12px;
    color: var(--weeb-fg-muted);
  }
  .show-time {
    font-family: var(--weeb-font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 12px;
    color: var(--weeb-fg-muted);
  }

  /* ---- Countdown Badges ---- */
  .show-countdown {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 8px;
    border-radius: 11px;
    font-size: 11px;
    font-weight: 600;
    font-family: var(--weeb-font-mono);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    margin-top: 4px;
    width: fit-content;
  }
  .show-countdown.upcoming {
    background: color-mix(in oklch, var(--weeb-accent) 15%, transparent);
    color: var(--weeb-accent-text, var(--weeb-accent-hover));
  }
  .show-countdown.aired {
    background: oklch(28% 0.015 275 / 0.6);
    color: var(--weeb-fg-secondary);
  }
  .show-countdown.airing-now {
    background: oklch(65% 0.15 155 / 0.15);
    color: var(--weeb-green);
  }
  .airing-now-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--weeb-green);
    animation: pulse-dot 2s infinite;
  }

  /* ---- Add Button ---- */
  .show-add-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--weeb-fg-muted);
    background: var(--weeb-bg);
    border: 1px solid var(--weeb-border);
    transition: all 0.15s;
    opacity: 0;
    cursor: pointer;
    padding: 0;
  }
  .show-card:hover .show-add-btn,
  .show-add-btn:focus-visible { opacity: 1; }
  .show-add-btn:hover {
    color: var(--weeb-accent-text);
    border-color: var(--weeb-accent);
    background: color-mix(in oklch, var(--weeb-accent) 10%, transparent);
  }

  /* ---- Load More Button ---- */
  .load-more-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    max-width: 400px;
    margin: 32px auto 0;
    padding: 14px 24px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    color: var(--weeb-fg-secondary);
    font-family: var(--weeb-font);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .load-more-btn:hover {
    background: var(--weeb-surface-hover);
    border-color: var(--weeb-accent);
    color: var(--weeb-fg);
  }
  .load-more-btn svg {
    transition: transform 0.2s;
  }
  .load-more-btn:hover svg {
    transform: translateY(2px);
  }

  /* ============================================
     CALENDAR VIEW
     ============================================ */
  .calendar-view { padding: 32px 0 64px; }
  .calendar-layout {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 24px;
    align-items: start;
  }
  .calendar-card {
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    overflow: hidden;
    transition: opacity 0.2s;
  }
  .calendar-card.loading .calendar-days {
    opacity: 0.4;
    pointer-events: none;
  }
  .cal-loading-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--weeb-accent);
    margin-left: 8px;
    animation: pulse-dot 1s infinite;
    vertical-align: middle;
  }
  .cal-nav-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .calendar-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--weeb-border);
  }
  .cal-nav-btn {
    width: 32px;
    height: 32px;
    border-radius: var(--weeb-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--weeb-fg-muted);
    transition: all 0.15s;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
  }
  .cal-nav-btn:hover { background: var(--weeb-surface-hover); color: var(--weeb-fg); }
  .calendar-month-label {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--weeb-fg);
  }
  .calendar-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border-bottom: 1px solid var(--weeb-border);
  }
  .cal-weekday {
    padding: 8px 0;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted);
  }
  .calendar-days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
  }
  .cal-day {
    min-height: 80px;
    padding: 8px;
    border: none;
    border-right: 1px solid var(--weeb-border);
    border-bottom: 1px solid var(--weeb-border);
    background: none;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s;
    position: relative;
  }
  .cal-day:nth-child(7n) { border-right: none; }
  .cal-day:hover { background: var(--weeb-surface-hover); }
  .cal-day:focus-visible {
    outline: 2px solid var(--weeb-accent);
    outline-offset: -2px;
  }
  .cal-day.other-month { opacity: 0.3; }
  .cal-day.is-skeleton { pointer-events: none; }
  .cal-day.today .cal-day-num {
    background: var(--weeb-accent);
    color: white;
    border-radius: 50%;
    font-weight: 700;
    font-size: 13px;
  }
  .cal-day.selected { background: color-mix(in oklch, var(--weeb-accent) 15%, transparent); }
  .cal-day.selected .cal-day-num {
    border: 2px solid var(--weeb-accent);
    border-radius: 50%;
    color: var(--weeb-accent-text);
    font-weight: 700;
  }
  .cal-day.today.selected .cal-day-num {
    background: var(--weeb-accent);
    color: white;
    border: none;
  }
  .cal-day-num {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 4px;
    color: var(--weeb-fg);
  }
  .cal-dots {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }
  .cal-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
  .cal-dot-accent { background: var(--weeb-accent); }
  .cal-dot-violet { background: var(--weeb-violet, oklch(62% 0.14 300)); }
  .cal-dot-green  { background: var(--weeb-green); }
  .cal-dot-amber  { background: var(--weeb-amber); }
  .cal-show-count {
    position: absolute;
    bottom: 4px;
    right: 6px;
    font-size: 10px;
    font-family: var(--weeb-font-mono);
    font-variant-numeric: tabular-nums;
    color: var(--weeb-fg-muted);
  }

  /* ---- Calendar Side Panel ---- */
  .cal-side-panel {
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    overflow: hidden;
    position: sticky;
    top: 72px;
  }
  .cal-panel-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--weeb-border);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cal-panel-label {
    font-size: 11px;
    color: var(--weeb-fg-muted);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 600;
  }
  .cal-panel-date {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--weeb-fg);
  }
  .cal-panel-shows { display: flex; flex-direction: column; }
  .cal-show-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    border-bottom: 1px solid var(--weeb-border);
    transition: background 0.1s;
    text-decoration: none;
    color: inherit;
  }
  .cal-show-item:last-child { border-bottom: none; }
  .cal-show-item:hover { background: var(--weeb-surface-hover); }
  .cal-show-poster {
    width: 36px;
    height: 50px;
    border-radius: calc(var(--weeb-radius) - 2px);
    flex-shrink: 0;
    overflow: hidden;
    background: var(--weeb-bg-elevated);
  }
  .cal-show-poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .cal-show-info { flex: 1; min-width: 0; }
  .cal-show-title {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
    color: var(--weeb-fg);
  }
  .cal-show-meta { display: flex; align-items: center; gap: 8px; }
  .cal-ep { font-size: 11px; color: var(--weeb-fg-muted); }
  .cal-time {
    font-family: var(--weeb-font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    color: var(--weeb-fg-muted);
  }

  /* ---- Responsive ---- */
  @media (max-width: 1024px) {
    .show-card { width: 290px; }
  }
  @media (max-width: 768px) {
    .show-card { width: 260px; }
    .page-header { padding: 24px 0 16px; }
    .page-title { font-size: 1.5rem; }
    .page-header-controls { width: 100%; }
  }
  @media (max-width: 900px) {
    .calendar-layout { grid-template-columns: 1fr; }
  }
  @media (max-width: 480px) {
    .airing-page { padding: 0 16px; }
    .show-card { width: 85vw; }
    .page-header-controls {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    .cal-day { min-height: 52px; padding: 4px; }
    .cal-day-num { width: 22px; height: 22px; font-size: 11px; }
    .cal-show-count { display: none; }
  }
</style>
