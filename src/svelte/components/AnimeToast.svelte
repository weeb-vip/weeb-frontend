<script lang="ts">
  import { onMount } from 'svelte';
  import { navigateWithTransition } from '../../utils/astro-navigation';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';

  export let anime: {
    id?: string | number;
    titleEn?: string;
    titleJp?: string;
    imageUrl?: string;
  };
  export let episode: {
    episodeNumber?: number;
    titleEn?: string;
    titleJp?: string;
  };
  export let status: 'airing-soon' | 'airing' | 'finished' | 'warning';
  export let timeInfo: string = '';

  let isMobile = false;

  onMount(() => {
    // Check if mobile/tablet including iPads
    const checkIfMobile = () => {
      // Check for touch capability (includes iPads)
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // Check viewport width (less than lg breakpoint)
      const isNarrowScreen = window.innerWidth < 1024;

      // Check for iPad specifically (including iPad Pro)
      const isIPad = /iPad|Macintosh/.test(navigator.userAgent) && hasTouch;

      // Check for other tablets and mobile devices
      const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      return isNarrowScreen || isIPad || (hasTouch && isMobileUserAgent);
    };

    isMobile = checkIfMobile();

    const handleResize = () => {
      isMobile = checkIfMobile();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  function handleShowClick(e: MouseEvent) {
    e.stopPropagation();
    if (anime.id) {
      navigateWithTransition(`/show/${anime.id}`);
    }
  }

  function handleContainerClick(e: MouseEvent) {
    // On desktop, clicking the container navigates to the show
    if (!isMobile && anime.id) {
      navigateWithTransition(`/show/${anime.id}`);
    }
  }

  const title = getAnimeTitle(anime, $preferencesStore.titleLanguage);
  const episodeTitle = episode?.titleEn || episode?.titleJp || '';
  const episodeNumber = episode?.episodeNumber || '?';

  const statusConfig = {
    'airing-soon': {
      icon: 'fa-clock',
      color: 'text-weeb-accent',
      bgColor: 'bg-weeb-surface',
      borderColor: 'border-weeb-border'
    },
    'airing': {
      icon: 'fa-play-circle',
      color: 'text-weeb-green',
      bgColor: 'bg-weeb-green/10',
      borderColor: 'border-weeb-green'
    },
    'finished': {
      icon: 'fa-check-circle',
      color: 'text-weeb-violet',
      bgColor: 'bg-weeb-violet/10',
      borderColor: 'border-weeb-violet'
    },
    'warning': {
      icon: 'fa-bell',
      color: 'text-weeb-amber',
      bgColor: 'bg-weeb-amber/10',
      borderColor: 'border-weeb-amber'
    }
  };

  const config = statusConfig[status];
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="anime-toast-content"
  class:clickable={!isMobile}
  on:click={handleContainerClick}
>
  <!-- Anime Image -->
  <div class="toast-poster">
    {#if anime.imageUrl}
      <img
        src={anime.imageUrl}
        alt={title}
        class="toast-poster-img"
        loading="lazy"
      />
    {:else}
      <div class="toast-poster-placeholder">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
      </div>
    {/if}
  </div>

  <!-- Content -->
  <div class="toast-body">
    <div class="toast-title">{title}</div>
    <div class="toast-episode">
      <span class="toast-ep-num">Episode {episodeNumber}</span>
      {#if episodeTitle}
        <span class="toast-dot">·</span>
        <span class="toast-ep-title">{episodeTitle}</span>
      {/if}
    </div>
    {#if timeInfo}
      <div class="toast-status toast-status-{status}">
        <svg class="toast-status-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          {#if status === 'finished'}
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
          {:else if status === 'airing'}
            <polygon points="5 3 19 12 5 21 5 3"/>
          {:else if status === 'warning'}
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          {:else}
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          {/if}
        </svg>
        {timeInfo}
      </div>
    {/if}
  </div>

  <!-- Status indicator -->
  {#if isMobile}
    <button
      on:click={handleShowClick}
      class="toast-action"
      type="button"
      title="Go to {title} page"
      aria-label="Go to {title} page"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
    </button>
  {:else}
    <div class="toast-indicator toast-indicator-{status}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        {#if status === 'finished'}
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
        {:else if status === 'airing'}
          <polygon points="5 3 19 12 5 21 5 3"/>
        {:else if status === 'warning'}
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        {:else}
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        {/if}
      </svg>
    </div>
  {/if}
</div>

<style>
  .anime-toast-content {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 2px;
  }
  .clickable {
    cursor: pointer;
  }

  /* Poster thumbnail */
  .toast-poster {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: 10px;
    overflow: hidden;
  }
  .toast-poster-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .toast-poster-placeholder {
    width: 100%;
    height: 100%;
    background: var(--weeb-surface-hover);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--weeb-fg-muted);
  }

  /* Body */
  .toast-body {
    flex: 1;
    min-width: 0;
  }
  .toast-title {
    font-weight: 600;
    font-size: 13px;
    color: var(--weeb-fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }
  .toast-episode {
    font-size: 12px;
    color: var(--weeb-fg-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
    margin-top: 1px;
  }
  .toast-ep-num {
    font-weight: 500;
  }
  .toast-dot {
    margin: 0 4px;
    opacity: 0.5;
  }
  .toast-ep-title {
    opacity: 0.8;
  }

  /* Status line */
  .toast-status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    margin-top: 3px;
    line-height: 1;
  }
  .toast-status-icon {
    flex-shrink: 0;
  }
  .toast-status-airing-soon { color: var(--weeb-accent); }
  .toast-status-airing { color: var(--weeb-green); }
  .toast-status-finished { color: var(--weeb-violet); }
  .toast-status-warning { color: var(--weeb-amber); }

  /* Status indicator circle (desktop) */
  .toast-indicator {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--weeb-border);
  }
  .toast-indicator-airing-soon {
    color: var(--weeb-accent);
    background: oklch(55% 0.15 280 / 0.1);
    border-color: oklch(55% 0.15 280 / 0.3);
  }
  .toast-indicator-airing {
    color: var(--weeb-green);
    background: oklch(62% 0.17 145 / 0.1);
    border-color: oklch(62% 0.17 145 / 0.3);
  }
  .toast-indicator-finished {
    color: var(--weeb-violet);
    background: oklch(62% 0.14 300 / 0.1);
    border-color: oklch(62% 0.14 300 / 0.3);
  }
  .toast-indicator-warning {
    color: var(--weeb-amber);
    background: oklch(75% 0.15 80 / 0.1);
    border-color: oklch(75% 0.15 80 / 0.3);
  }

  /* Mobile action button */
  .toast-action {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--weeb-accent);
    color: white;
    border: none;
    cursor: pointer;
    transition: transform 0.15s ease;
  }
  .toast-action:hover {
    transform: scale(1.08);
  }
</style>
