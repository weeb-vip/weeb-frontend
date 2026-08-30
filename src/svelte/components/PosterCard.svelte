<script lang="ts">
  import SafeImage from './SafeImage.svelte';
  import { getSafeImageUrl } from '../utils/image';
  import { analytics } from '../../utils/analytics';
  import { animeHref } from '../../services/utils';
  import { normalizeStatus, type AnimeStatus } from '../utils/status';

  export let id: string;
  // Optional: callers that have not been given the slug yet fall back to
  // /show/<id>, which permanently redirects.
  export let slug: string | null | undefined = undefined;
  export let title: string;
  export let image: string;
  // Which CDN folder the poster lives in. Anime posters are the default; works
  // are stored under works/ by image-sync, and passing the id without this
  // would ask the CDN for an anime poster that does not exist.
  export let imagePath: string = 'posters';
  export let score: number | string | null = null;
  export let status: string | null = null;
  export let sub: string = '';
  export let href: string = '';
  export let genres: string[] = [];
  export let description: string = '';
  export let episodeCount: number | null = null;
  export let onList: string | null = null;

  $: normalizedStatus = normalizeStatus(onList);

  // Prefer TheTVDB's 680x1000 series poster over the scraper's MyAnimeList
  // image, which MAL serves at 225px wide -- soft on any 2x display at card
  // size, and this component renders 54 times on the homepage alone. Falls back
  // per-anime, so the shows TheTVDB does not carry are unaffected.
  //
  // Costs no extra request: SafeImage resolves candidates in order and stops at
  // the first that loads.
  $: posterSources = image ? [getSafeImageUrl(image, imagePath), getSafeImageUrl(image)] : [];
</script>

<a
  class="poster-card"
  href={href || animeHref({ id, slug })}
  on:click={() => analytics.animeViewed(id, title)}
>
  <div class="poster">
    <SafeImage
      sources={posterSources}
      alt={title}
      className="poster-img"
      fallbackSrc="/assets/not found.jpg"
      placeholderTitle={title}
      cdnWidth={360}
    />
    {#if score}
      <span class="score-badge">{typeof score === 'number' ? score.toFixed(1) : score}</span>
    {/if}
    {#if !normalizedStatus}
      {#if status === 'CURRENTLY_AIRING' || status === 'airing'}
        <span class="status-dot airing"></span>
      {:else if status === 'upcoming' || status === 'NOT_YET_RELEASED'}
        <span class="status-dot upcoming"></span>
      {/if}
    {/if}
    {#if normalizedStatus}
      <span class="on-list-tab" class:watching={normalizedStatus === 'WATCHING'} class:completed={normalizedStatus === 'COMPLETED'} class:plan={normalizedStatus === 'PLANTOWATCH'} class:dropped={normalizedStatus === 'DROPPED'} class:on-hold={normalizedStatus === 'ONHOLD'}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          {#if normalizedStatus === 'WATCHING'}
            <polygon points="5,3 19,12 5,21" />
          {:else if normalizedStatus === 'COMPLETED'}
            <polyline points="4,12 10,18 20,6" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
          {:else if normalizedStatus === 'DROPPED'}
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          {:else if normalizedStatus === 'ONHOLD'}
            <rect x="5" y="4" width="4" height="16" rx="1" />
            <rect x="15" y="4" width="4" height="16" rx="1" />
          {:else}
            <path d="M5 3h14a1 1 0 011 1v16.5a.5.5 0 01-.8.4L12 16l-6.2 4.9A.5.5 0 015 20.5V4a1 1 0 011-1z" />
          {/if}
        </svg>
      </span>
    {/if}
    <div class="hover-overlay" aria-hidden="true">
      <div class="hover-content">
        {#if description}
          <p class="hover-desc">{description.replace(/<[^>]*>/g, '').slice(0, 120)}{description.length > 120 ? '...' : ''}</p>
        {/if}
        <div class="hover-meta">
          {#if episodeCount}
            <span class="hover-meta-item">{episodeCount} episodes</span>
          {/if}
          {#if score}
            <span class="hover-meta-item hover-score">&#9733; {typeof score === 'number' ? score.toFixed(1) : score}</span>
          {/if}
        </div>
        {#if genres.length > 0}
          <div class="hover-genres">
            {#each genres.slice(0, 3) as genre}
              <span class="hover-genre">{genre}</span>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
  <div class="poster-title">{title}</div>
  {#if sub}
    <div class="poster-sub">{sub}</div>
  {/if}
  <slot />
</a>

<style>
  .poster-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    cursor: pointer;
    text-decoration: none;
    color: inherit;
  }
  .poster {
    aspect-ratio: 2/3;
    width: 100%;
    border-radius: var(--weeb-radius, 8px);
    background: var(--weeb-surface);
    overflow: hidden;
    position: relative;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  @media (hover: hover) and (pointer: fine) {
    .poster-card:hover .poster {
      transform: translateY(-4px);
      box-shadow: var(--weeb-shadow-card);
    }
  }
  .poster :global(.poster-img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .poster :global(.poster-img img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  /* Numeral step. A score is a measured value like the sub-line beneath it, and
     rendering one in the sans and the other in mono broke the family. */
  .score-badge {
    font-family: var(--weeb-font-mono);
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 2px 7px;
    border-radius: 4px;
    background: var(--weeb-scrim);
    backdrop-filter: blur(8px);
    font-size: 12px;
    font-weight: 700;
    color: var(--weeb-amber);
    font-variant-numeric: tabular-nums;
  }
  .status-dot {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .status-dot.airing {
    background: var(--weeb-green);
    box-shadow: 0 0 8px var(--weeb-green);
  }
  .status-dot.upcoming {
    background: var(--weeb-amber);
  }
  .on-list-tab {
    position: absolute;
    top: 0;
    right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    padding: 4px 0 8px;
    background: var(--weeb-accent);
    color: white;
    font-size: 12px;
    opacity: 0.9;
    transition: opacity 0.2s;
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%);
  }
  .on-list-tab.watching {
    background: var(--weeb-green);
  }
  .on-list-tab.completed {
    background: var(--weeb-accent);
  }
  .on-list-tab.plan {
    background: var(--weeb-amber);
  }
  .on-list-tab.dropped {
    background: var(--weeb-red);
  }
  .on-list-tab.on-hold {
    background: var(--weeb-fg-muted);
  }
  .hover-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      oklch(0% 0 0 / 0.92) 0%,
      oklch(0% 0 0 / 0.8) 40%,
      oklch(0% 0 0 / 0.5) 70%,
      oklch(0% 0 0 / 0.2) 100%
    );
    backdrop-filter: blur(2px);
    display: flex;
    align-items: flex-end;
    padding: 12px;
    opacity: 0;
    transition: opacity 0.25s;
    pointer-events: none;
  }
  @media (hover: hover) and (pointer: fine) {
    .poster-card:hover .hover-overlay {
      opacity: 1;
    }
  }
  .hover-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }
  .hover-desc {
    font-size: 12px;
    line-height: 1.4;
    color: var(--weeb-fg);
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .hover-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--weeb-fg-secondary);
  }
  .hover-meta-item {
    white-space: nowrap;
  }
  .hover-score {
    color: var(--weeb-amber);
    font-weight: 600;
  }
  .hover-genres {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .hover-genre {
    padding: 2px 7px;
    border-radius: var(--weeb-radius-full, 999px);
    background: var(--weeb-border);
    border: 1px solid var(--weeb-border);
    font-size: 12px;
    font-weight: 500;
    color: var(--weeb-fg);
    white-space: nowrap;
  }
  .poster-title {
    margin-top: 8px;
    /* Title step. Was 13/500 -- a size the ramp does not define -- and 12px on a
       phone, identical to the metadata beneath it, so the card had no internal
       hierarchy at the size most people read it. */
    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
    min-height: calc(2 * 1.3em);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  /* Numeral step: "28 ep · 2023" is a measured value, and the Mono Numeral Rule
     puts every count and date in the mono face. Set in the sans it read as a
     second title rather than as metadata. */
  .poster-sub {
    font-family: var(--weeb-font-mono);
    font-size: 12px;
    color: var(--weeb-fg-muted);
    margin-top: 2px;
  }

  /* --- Mobile --- */
  @media (max-width: 480px) {
    .poster-title {
      font-size: 15px;
      margin-top: 6px;
      min-height: calc(2 * 1.3em);
    }
    .poster-sub {
      font-size: 12px;
    }
    .score-badge {
      font-size: 12px;
      padding: 1px 5px;
      top: 5px;
      left: 5px;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      top: 5px;
      right: 5px;
    }
  }
</style>
