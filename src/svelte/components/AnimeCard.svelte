<script lang="ts">
  import { onMount } from 'svelte';
  import SafeImage from './SafeImage.svelte';
  import ScrollingText from './ScrollingText.svelte';
  import ScrollingTags from './ScrollingTags.svelte';
  import { STATUS_LABELS } from '../utils/status';
  import { analytics } from '../../utils/analytics';

  export let style: 'default' | 'hover-transparent' | 'hover' | 'transparent' | 'long' | 'detail' | 'episode' = 'default';
  export let forceListLayout: boolean = false;
  export let title: string;
  export let description: string;
  export let episodes: number | string;
  export let episodeLength: string;
  export let year: string;
  export let image: string;
  export let id: string | null | undefined;
  export let className: string = '';
  export let airTime: {
    show: boolean;
    text: string;
    variant?: 'countdown' | 'scheduled' | 'aired' | 'airing';
  } | undefined = undefined;
  export let entry: { status?: string } | null = null;

  // Episode specific props
  export let airdate: string = '';
  export let episodeTitle: string = '';
  export let episodeNumber: string = '';

  // Tags/genres for card display
  export let tags: string[] = [];

  const statusLabels = STATUS_LABELS;

  const cardStyles = {
    default: `w-48 h-72`,
    'hover-transparent': `w-48 h-72 hover:bg-weeb-surface-hover`,
    hover: `w-48 h-72 hover:bg-weeb-surface-hover hover:shadow-lg`,
    transparent: `w-48 h-72 bg-transparent`,
    long: `w-96 h-96`,
    detail: ``,
    episode: ``,
  };

  function getAirTimeColorClasses(variant?: string) {
    switch (variant) {
      case 'countdown': return 'text-weeb-red';
      case 'airing': return 'text-weeb-amber';
      case 'aired': return 'text-weeb-green';
      default: return 'text-weeb-accent';
    }
  }

  // Estimate duration based on available data
  function getEstimatedDuration(): { value: string; isEstimate: boolean } {
    // If we have actual duration, use it
    if (episodeLength && episodeLength !== 'Unknown' && episodeLength !== '') {
      return { value: episodeLength, isEstimate: false };
    }

    // Check if it's a short based on tags
    const isShort = tags?.some(tag =>
      tag.toLowerCase().includes('short') ||
      tag.toLowerCase().includes('music')
    );
    if (isShort) {
      return { value: '~12 min', isEstimate: true };
    }

    // Check if it's likely a movie (1 episode or movie-related tags)
    const isMovie = tags?.some(tag =>
      tag.toLowerCase().includes('movie')
    ) || (episodes === 1 || episodes === '1');
    if (isMovie) {
      return { value: '~90 min', isEstimate: true };
    }

    // Default to standard TV anime length
    return { value: '~24 min', isEstimate: true };
  }

  // Get episode display
  function getEpisodeDisplay(): { value: string | number; isTBA: boolean } {
    if (episodes && episodes !== 0 && episodes !== '0') {
      return { value: episodes, isTBA: false };
    }
    return { value: 'TBA', isTBA: true };
  }

  $: durationDisplay = getEstimatedDuration();
  $: episodeDisplay = getEpisodeDisplay();
</script>

<div class="flex {forceListLayout ? 'flex-row' : 'sm:flex-row md:flex-col'} rounded-md shadow w-full justify-center transition-all duration-300 {className} relative h-full" style="background: var(--weeb-surface);">
  <!-- Watchlist indicator -->
  {#if entry?.status}
    <div class="watchlist-badge">
      <i class="fas fa-bookmark text-xs mr-1"></i>
      {statusLabels[entry.status] || 'Unknown'}
    </div>
  {/if}

  <a href="/show/{id}"
     on:click={() => analytics.animeViewed(id || '', title)}
     class="flex flex-col {cardStyles[style]} overflow-hidden transition-colors duration-300 {forceListLayout ? 'rounded-l-md h-full flex-shrink-0 flex-grow-0 w-32' : 'flex-shrink sm:flex-shrink md:flex-shrink-0 rounded-l-md lg:rounded-bl-none lg:rounded-t-md'}" style="background: var(--weeb-surface);">
    <SafeImage
            src={image}
            alt={title}
            className="{forceListLayout ? 'object-cover h-full relative' : 'aspect-2/3 object-cover w-full h-full relative'}"
            fallbackSrc="/assets/not found.jpg"
    />
  </a>

  {#if style === 'detail'}
    <div class="flex flex-col flex-grow min-w-0 px-4 py-2 h-full relative w-full group">
      <a href="/show/{id}" on:click={() => analytics.animeViewed(id || '', title)} class="flex overflow-hidden flex-col w-full flex-grow">
        <ScrollingText
                text={title}
                className="text-md font-bold text-weeb-fg"
                maxWidth="100%"
        />

        <ScrollingTags {tags} className="mt-1" />

        <div class="flex flex-col space-y-2 text-md font-normal mt-2 items-start text-weeb-fg-secondary">
          <div class="flex items-center">
            <i class="fas fa-tv text-sm w-4 text-center mr-2"></i>
            <span class={episodeDisplay.isTBA ? 'text-weeb-fg-muted' : ''}>{episodeDisplay.value}</span>
          </div>
          <div class="flex items-center" title={durationDisplay.isEstimate ? 'Estimated duration' : ''}>
            <i class="fas fa-clock text-sm w-4 text-center mr-2"></i>
            <span class="{durationDisplay.isEstimate ? 'text-weeb-fg-muted italic' : ''}">{durationDisplay.value}</span>
          </div>
          <div class="flex items-center">
            <i class="fas fa-calendar text-sm w-4 text-center mr-2"></i>
            <span class={year === 'TBA' || !year ? 'text-weeb-fg-muted' : ''}>{year || 'TBA'}</span>
          </div>
          {#if airTime?.show}
            <div class="flex items-center {getAirTimeColorClasses(airTime.variant)}">
              <i class="fas fa-broadcast-tower text-sm w-4 text-center mr-2"></i>
              <span class="text-xs font-medium">{airTime.text}</span>
            </div>
          {/if}
        </div>
      </a>

      <!-- Always positioned at bottom -->
      <div class="flex flex-wrap gap-2 options w-full mt-auto pt-3 {forceListLayout ? 'justify-start' : 'justify-center'}">
        <slot name="options"></slot>
      </div>
    </div>
  {/if}

  {#if style === 'episode'}
    <div class="flex flex-col flex-grow min-w-0 px-4 py-2 h-full relative w-full group">
      <a href="/show/{id}" on:click={() => analytics.animeViewed(id || '', title)} class="flex flex-col overflow-hidden w-full flex-grow">
        <ScrollingText
                text={title}
                className="text-md font-bold text-weeb-fg"
                maxWidth="100%"
        />

        <ScrollingTags {tags} className="mt-1" />

        <ScrollingText
                text={episodeTitle}
                className="text-md font-normal text-weeb-fg mt-1"
                maxWidth="100%"
        />

        <div class="flex flex-col w-full justify-between space-y-2">
          <span class="flex-grow text-md text-base space-x-4 text-weeb-fg-muted">
            <span>episode {episodeNumber}</span>
          </span>

          {#if airTime?.show}
            <div class="flex items-center {getAirTimeColorClasses(airTime.variant)}">
              <i class="fas fa-broadcast-tower text-sm w-4 text-center mr-2"></i>
              <span class="text-xs font-medium">{airTime.text}</span>
            </div>
          {:else}
            <span class="flex-grow text-md text-base space-x-4 text-weeb-fg-muted">
              <span>{airdate}</span>
            </span>
          {/if}
        </div>
      </a>

      <!-- Always positioned at bottom -->
      <div class="flex flex-wrap gap-2 options w-full mt-auto pt-3 {forceListLayout ? 'justify-start' : 'justify-center'}">
        <slot name="options"></slot>
      </div>
    </div>
  {/if}
</div>

<style>
  .watchlist-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    background: var(--weeb-accent);
    color: white;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: var(--weeb-radius-full, 9999px);
    font-weight: 500;
    box-shadow: var(--weeb-shadow-card);
    z-index: 10;
  }
</style>
