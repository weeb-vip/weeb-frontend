<script lang="ts">
  import SafeImage from './SafeImage.svelte';
  import { analytics } from '../../utils/analytics';

  export let id: string;
  export let title: string;
  export let image: string;
  export let score: number | string | null = null;
  export let status: string | null = null;
  export let sub: string = '';
  export let href: string = '';
  export let genres: string[] = [];
  export let description: string = '';
  export let episodeCount: number | null = null;
</script>

<a
  class="poster-card"
  href={href || `/show/${id}`}
  on:click={() => analytics.animeViewed(id, title)}
>
  <div class="poster">
    <SafeImage
      src={image}
      alt={title}
      className="poster-img"
      fallbackSrc="/assets/not found.jpg"
    />
    {#if score}
      <span class="score-badge">{typeof score === 'number' ? score.toFixed(1) : score}</span>
    {/if}
    {#if status === 'CURRENTLY_AIRING' || status === 'airing'}
      <span class="status-dot airing"></span>
    {:else if status === 'upcoming' || status === 'NOT_YET_RELEASED'}
      <span class="status-dot upcoming"></span>
    {/if}
    <div class="hover-overlay">
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
    cursor: pointer;
    text-decoration: none;
    color: inherit;
  }
  .poster {
    aspect-ratio: 2/3;
    border-radius: var(--weeb-radius, 8px);
    background: var(--weeb-surface);
    overflow: hidden;
    position: relative;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  @media (hover: hover) and (pointer: fine) {
    .poster-card:hover .poster {
      transform: translateY(-4px);
      box-shadow: 0 12px 32px oklch(0% 0 0 / 0.4);
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
  .score-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 2px 7px;
    border-radius: 4px;
    background: oklch(0% 0 0 / 0.7);
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
    font-size: 11px;
    line-height: 1.4;
    color: oklch(85% 0.005 265);
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .hover-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: oklch(70% 0.01 270);
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
    background: oklch(100% 0 0 / 0.12);
    border: 1px solid oklch(100% 0 0 / 0.2);
    font-size: 10px;
    font-weight: 500;
    color: oklch(90% 0.005 265);
    white-space: nowrap;
  }
  .poster-title {
    margin-top: 8px;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.3;
    min-height: calc(2 * 1.3em);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .poster-sub {
    font-size: 12px;
    color: var(--weeb-fg-muted);
    margin-top: 2px;
  }

  /* --- Mobile --- */
  @media (max-width: 480px) {
    .poster-title {
      font-size: 11px;
      margin-top: 6px;
      min-height: calc(2 * 1.3em);
    }
    .poster-sub {
      font-size: 10px;
    }
    .score-badge {
      font-size: 10px;
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
